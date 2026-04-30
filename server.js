import express from 'express'
import 'dotenv/config'
import { handleClaude, extractIp } from './lib/anthropic.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.post('/api/claude', async (req, res) => {
  return handleClaude({ ip: extractIp(req), body: req.body }, res)
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[ff-ev] proxy listening on http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[ff-ev] WARNING: ANTHROPIC_API_KEY not set — copy .env.example to .env')
  }
})
