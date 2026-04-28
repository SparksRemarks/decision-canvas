# FF EV Calculator — AI Roundtable Demo

A live decision stress-test tool. Five structured steps; AI is interpretation
and gap-filling, not generation. Built for a 7-minute live demo.

## Quickstart

```bash
npm install
cp .env.example .env          # add your ANTHROPIC_API_KEY
npm run dev                   # boots Express proxy + Vite
# open http://localhost:5173
```

`npm run dev` runs two processes:
- `server.js` on `:3001` — proxies `/api/claude` → `api.anthropic.com` (keeps the key server-side, sidesteps CORS)
- Vite on `:5173` — serves the React app, proxies `/api/*` → `:3001`

## The 5 steps

1. **Decision** — free text. Claude reflects back a 2-sentence framing.
2. **Options** — 2 to 5 options. Claude surfaces the one they didn't name.
3. **Dimensions** — Claude proposes 4 evaluation dimensions for *this* decision; user can edit names + flip direction.
4. **Ratings** — 1-5 per option per dimension. Live exponential scoring (`r²`, inverted for ↓ dims). No API call.
5. **Read** — ranked list + 3-sentence read: VALUE / CRUX / RISK.

## Demo fallback

If the network flakes on stage, click **Load demo scenario** on Step 1 — it
jumps straight to Step 4 (Ratings) with the enterprise-vs-pricing-vs-sales-lead
scenario pre-rated. Step 5 (the read) still requires the API.

## Files

```
server.js              Express proxy
vite.config.js         Vite + /api proxy
src/App.jsx            5-step state machine
src/prompts.js         Step prompts + parsers
src/demoScenario.js    Pre-loaded fallback
src/styles.css         FF aesthetic (dark + light)
src/CubeLogo.jsx       Wireframe cube
```

## Models

Default: `claude-sonnet-4-6`. Override via `CLAUDE_MODEL` in `.env`.
For the live read on stage, `claude-opus-4-7` will be sharper but ~2-3× slower.
