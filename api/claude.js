import { handleClaude, extractIp } from '../lib/anthropic.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  return handleClaude({ ip: extractIp(req), body: req.body }, res)
}
