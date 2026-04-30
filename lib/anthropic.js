// Shared logic between the local Express proxy (server.js) and the Vercel
// serverless function (api/claude.js). Both call handleClaude(), which:
//   - enforces the API key is set
//   - rate-limits per IP (in-memory, best-effort on serverless)
//   - proxies to api.anthropic.com and returns the text
//
// In-memory rate limiting works perfectly for the local dev server and is
// "good enough" for a low-traffic Vercel deployment: warm function instances
// preserve the bucket map. For higher-traffic production you'd swap this for
// Vercel KV / Upstash Redis — same interface, different storage.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60', 10)
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || String(60 * 60 * 1000),
  10
)

const buckets = new Map()

function checkRate(ip) {
  const now = Date.now()

  // Periodic cleanup of expired buckets to keep memory bounded.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt < now) buckets.delete(k)
    }
  }

  const bucket = buckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: bucket.resetAt - now }
  }
  bucket.count++
  return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count }
}

export async function handleClaude({ ip, body }, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' })
  }

  const rate = checkRate(ip || 'unknown')
  if (!rate.allowed) {
    const minutes = Math.max(1, Math.ceil(rate.retryAfter / 60000))
    return res.status(429).json({
      error: `Rate limit hit. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
    })
  }

  const { system, messages, model = DEFAULT_MODEL, max_tokens = 1024 } = body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' })
  }

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ model, max_tokens, system, messages })
    })
    const data = await r.json()
    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || 'API error'
      })
    }
    const text = data?.content?.map(b => b.text || '').join('') || ''
    res.json({ text, usage: data.usage, rateLimitRemaining: rate.remaining })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export function extractIp(req) {
  return (
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}
