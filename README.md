# FF EV Calculator — AI Roundtable Demo

A live decision stress-test tool. Five structured steps; AI is interpretation
and gap-filling, not generation. Built for a 7-minute live demo, runs locally
or as a shared link on Vercel.

## Quickstart (local)

```bash
./start.sh
```

First run: creates `.env`, prompts you to paste your `ANTHROPIC_API_KEY`, exits.
Second run (and every run after): boots on http://localhost:5173.

The script never overwrites an existing `.env`, so your key persists between
sessions. You can close the terminal and re-run `./start.sh` any time.

Manual equivalent if you prefer:
```bash
npm install
cp .env.example .env          # ONE TIME ONLY — paste your key, then never re-run this
npm run dev
```

## Deploying to Vercel (shareable link)

The same code runs as a Vercel project — `api/claude.js` is a serverless
function, the React app is built and served as static assets, and the frontend
calls `/api/claude` exactly the same as it does locally.

1. Sign up at https://vercel.com with your GitHub account (free tier is fine).
2. Click **Add New → Project**, pick the `decision-canvas` repo, leave the
   build settings as auto-detected (Vite).
3. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - (optional) `CLAUDE_MODEL` = `claude-opus-4-7` for sharper reads, or leave unset for `claude-sonnet-4-6`
   - (optional) `RATE_LIMIT_MAX` = number of API calls per IP per hour (default 60)
4. Click **Deploy**. After ~30s you get a URL like
   `decision-canvas.vercel.app`. Share it.

Every push to the deployed branch auto-redeploys.

### What's on by default

- **Rate limiting**: 60 API calls per IP per hour. A full run-through is ~5
  calls, so this allows ~12 flows per visitor per hour. Returns HTTP 429 with
  a friendly message when exceeded. In-memory; works on warm Vercel instances
  (fine for low-traffic). For production traffic, swap `lib/anthropic.js` to
  use Vercel KV or Upstash Redis.
- **Privacy footer**: visible note that inputs go to Anthropic for processing
  and are not stored by us.
- **Server-side key**: the API key never leaves the server. Frontend only
  knows about `/api/claude`.

### Cost notes

Each full flow uses ~$0.02–0.05 of Anthropic credit on Sonnet 4.6 (4–5 API
calls). 100 visitors ≈ $2–5. The rate limit caps a single abuser at roughly
$0.50/hour worth of calls.

## The 5 steps

1. **Decision** — free text + AI-suggested context questions, then a 2-sentence framing.
2. **Options** — 2 to 5 options. Surface the one you didn't name. Pick your gut prediction.
3. **Factors** — AI proposes 4 evaluation factors specific to this decision; edit, keep, or regenerate with feedback.
4. **Ratings** — sliders 1–5 per option per factor. No API call.
5. **Analysis** — ranked list, prediction-vs-actual gap, plus 3 sentences: VALUE / CRUX / RISK. Refine with feedback.

## Files

```
api/claude.js          Vercel serverless function
server.js              Express proxy for local dev
lib/anthropic.js       Shared call + rate-limiting logic
vite.config.js         Vite dev server (proxies /api → :3001)
vercel.json            Vercel build config
src/App.jsx            5-step state machine
src/prompts.js         Step prompts + parsers
src/demoScenario.js    Pre-loaded fallback (Series A SaaS)
src/styles.css         FF aesthetic (dark + light)
src/CubeLogo.jsx       Wireframe cube
start.sh               Idempotent local boot script
```

## Models

Default: `claude-sonnet-4-6`. Override via `CLAUDE_MODEL` env var.
For the live read on stage, `claude-opus-4-7` will be sharper but ~2-3× slower.
