// Prompt builders for each step. Kept as pure functions so they can be tested.

export function framingPrompt(decision) {
  return {
    system: `You are helping someone stress-test a decision using a structured framework.
Reflect their decision back in EXACTLY 2 sentences:
"You're deciding [precise framing of what they're choosing between]. The core tension is [the underlying conflict that makes this hard]."

Be specific and accurate. The framing should feel sharper than how they stated it — name what's actually at stake.
No preamble. No follow-up question. Just the 2 sentences.`,
    user: `Decision they wrote: "${decision}"`
  }
}

export function missingOptionPrompt(decision, options) {
  return {
    system: `The user is evaluating a decision and listed 2-5 options. Surface ONE option they didn't name but should consider. Look for:
- the do-nothing / status-quo option
- the avoided path they're flinching from
- a middle path between two extremes
- a creative reframe that sidesteps the dichotomy

Output exactly one sentence in this format:
"[Option name] — [one-line reason it deserves a seat at the table]."

Do not restate any of their existing options. No preamble.`,
    user: `Decision: ${decision}\n\nOptions they listed:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
  }
}

export function dimensionsPrompt(decision, options) {
  return {
    system: `Given a decision and its options, propose 4 evaluation dimensions specific to THIS decision (not generic ones like "cost" or "risk" unless they're the actual crux here).

Each dimension must:
- be a 1-3 word noun phrase
- meaningfully differentiate between the listed options
- be ratable on a 1-5 scale
- have a direction: "up" if more is better, "down" if less is better

Return ONLY a valid JSON array, no markdown fences, no preamble:
[
  {"name": "Time to revenue", "direction": "down"},
  {"name": "Strategic optionality", "direction": "up"},
  {"name": "Capital required", "direction": "down"},
  {"name": "Founder leverage", "direction": "up"}
]`,
    user: `Decision: ${decision}\n\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
  }
}

export function readoutPrompt({ decision, options, dimensions, ranked, ratings }) {
  const ratingTable = ratings.map(r =>
    `${r.option}:\n${r.scores.map(s => `  ${s.dim} (${s.direction === 'up' ? '↑' : '↓'}): ${s.rating ?? '—'}`).join('\n')}`
  ).join('\n\n')

  const rankList = ranked.map((r, i) => `${i + 1}. ${r.name} — ${r.score}`).join('\n')

  return {
    system: `You give a 3-sentence read on a decision the user has just scored. Output EXACTLY this format, three lines, each starting with the label:

VALUE: [what they're actually optimizing for, based on which dimensions and ratings drove the top option — name it directly, may surprise them. Not what they SAID matters; what the numbers show matters.]
CRUX: [the single load-bearing assumption of the top-ranked option — what has to be true for this to be the right call.]
RISK: [the most plausible failure mode of the top option — the way this goes wrong.]

Each line: one sentence, starting with the all-caps label and a colon. No preamble. No closing remarks. No bullets. No markdown.`,
    user: `Decision: ${decision}

Options:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Dimensions: ${dimensions.map(d => `${d.name} (${d.direction})`).join(', ')}

Ratings (1-5):
${ratingTable}

Ranking by weighted score (rating² with ↓ dims inverted):
${rankList}`
  }
}

export function parseDimensions(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) {
    throw new Error('Could not parse dimensions from response')
  }
  const arr = JSON.parse(cleaned.slice(start, end + 1))
  return arr
    .filter(d => d && typeof d.name === 'string')
    .map(d => ({
      name: d.name,
      direction: d.direction === 'down' ? 'down' : 'up'
    }))
    .slice(0, 4)
}

export function parseReadout(text) {
  const grab = (label) => {
    const re = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i')
    const m = text.match(re)
    return m ? m[1].trim() : ''
  }
  return {
    value: grab('VALUE'),
    crux: grab('CRUX'),
    risk: grab('RISK')
  }
}
