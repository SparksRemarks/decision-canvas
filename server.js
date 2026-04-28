import express from 'express'
import 'dotenv/config'

const app = express()
app.use(express.json({ limit: '1mb' }))

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'

app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' })
  }

  const { system, messages, model = DEFAULT_MODEL, max_tokens = 1024 } = req.body || {}
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
      return res.status(r.status).json({ error: data?.error?.message || 'API error', detail: data })
    }
    const text = data?.content?.map(b => b.text || '').join('') || ''
    res.json({ text, usage: data.usage })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY, model: DEFAULT_MODEL })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[ff-ev] proxy listening on http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[ff-ev] WARNING: ANTHROPIC_API_KEY not set — copy .env.example to .env')
  }
})
