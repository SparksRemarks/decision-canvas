// Prompt builders for each step. Pure functions so they can be tested.

export function contextQuestionsPrompt(decision) {
  return {
    system: `Given a decision someone is sitting with, identify the 2-3 most useful pieces of context to ask about so the framing can be sharp. Things like: timeline, what they've already ruled out, who else is affected, what success would look like, what would make the choice easy.

Output exactly 2-3 short questions, one per line. No numbering, no bullets, no preamble. Each question should be specific to THIS decision, not generic.`,
    user: `Decision: "${decision}"`
  }
}

export function framingPrompt(decision, context) {
  return {
    system: `You are helping someone stress-test a decision using a structured framework.
Reflect their decision back in EXACTLY 2 sentences:
"You're deciding [precise framing of what they're choosing between]. The core tension is [the underlying conflict that makes this hard]."

Be specific and accurate. The framing should feel sharper than how they stated it — name what's actually at stake.
No preamble. No follow-up question. Just the 2 sentences.`,
    user: context && context.trim()
      ? `Decision: "${decision}"\n\nAdditional context they provided:\n${context.trim()}`
      : `Decision: "${decision}"`
  }
}

export function missingOptionPrompt(decision, options, alreadySuggested = []) {
  return {
    system: `The user is evaluating a decision and listed 2-5 options. Surface ONE option they didn't name but should consider. Look for:
- the do-nothing / status-quo option
- the avoided path they're flinching from
- a middle path between two extremes
- a creative reframe that sidesteps the dichotomy

Output exactly one sentence in this format:
"[Option name] — [one-line reason it deserves a seat at the table]."

Do not restate any of their existing options. ${alreadySuggested.length ? 'Do not repeat or paraphrase any option that appears in the "Already suggested" list — propose something genuinely different.' : ''} No preamble.`,
    user: `Decision: ${decision}

Options they listed:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}${
      alreadySuggested.length
        ? `\n\nAlready suggested (do NOT repeat or restate these — propose something different):\n${alreadySuggested.map(s => `- ${s}`).join('\n')}`
        : ''
    }`
  }
}

export function dimensionsPrompt(decision, options, kept = [], feedback = '') {
  const need = Math.max(1, 4 - kept.length)
  return {
    system: `Propose ${need} evaluation dimension${need === 1 ? '' : 's'} specific to THIS decision (not generic ones unless they're the actual crux).

CRITICAL: All dimensions must be framed so HIGHER rating = BETTER outcome. (e.g. "Speed" not "Time to revenue", "Capital efficiency" not "Capital required", "Safety" not "Risk".)

Each dimension:
- 1-3 word noun phrase
- meaningfully differentiates between the listed options
- ratable on a 1-5 scale where 5 is best

Return ONLY a valid JSON array of exactly ${need} object${need === 1 ? '' : 's'}, no markdown fences, no preamble:
[{"name": "Speed"}${need > 1 ? ', {"name": "Founder leverage"}' : ''}]${
      kept.length
        ? `\n\nThe user is keeping these dimensions; do NOT repeat them or anything semantically similar:\n${kept.map(k => `- ${k.name}`).join('\n')}`
        : ''
    }${feedback && feedback.trim() ? `\n\nUser feedback to steer the new dimensions:\n${feedback.trim()}` : ''}`,
    user: `Decision: ${decision}\n\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
  }
}

export function analysisPrompt({ decision, context, options, dimensions, ranked, ratings, predictedTop }) {
  const ratingTable = ratings.map(r =>
    `${r.option}:\n${r.scores.map(s => `  ${s.dim}: ${s.rating ?? '—'}`).join('\n')}`
  ).join('\n\n')

  const rankList = ranked.map((r, i) => `${i + 1}. ${r.name} — ${r.score}`).join('\n')
  const actualTop = ranked[0]?.name
  const gapLine = predictedTop && actualTop && predictedTop !== actualTop
    ? `\n\nNOTE: The user predicted "${predictedTop}" would rank highest. The numbers ranked "${actualTop}" first. The gap between prediction and result is itself a signal — surface it in your VALUE line if relevant.`
    : predictedTop && predictedTop === actualTop
    ? `\n\nNOTE: The user correctly predicted "${actualTop}" would rank highest. Their gut and the numbers agree.`
    : ''

  return {
    system: `You give a 3-sentence analysis of a decision the user has just scored. Output EXACTLY this format, three lines, each starting with the label:

VALUE: [what they're actually optimizing for, based on which dimensions and ratings drove the top option — name it directly. Not what they SAID matters; what the numbers show matters.]
CRUX: [the single load-bearing assumption of the top-ranked option — what has to be true for this to be the right call.]
RISK: [the most plausible failure mode of the top option — the way this goes wrong.]

Each line: one sentence, starting with the all-caps label and a colon. No preamble. No closing remarks. No bullets. No markdown.`,
    user: `Decision: ${decision}${context ? `\n\nContext: ${context}` : ''}

Options:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Dimensions (all scored 1-5, higher is better): ${dimensions.map(d => d.name).join(', ')}

Ratings:
${ratingTable}

Ranking by total score (sum of rating²):
${rankList}${gapLine}`
  }
}

export function parseQuestions(text) {
  return text
    .trim()
    .split('\n')
    .map(l => l.replace(/^[\s\-\d\.\)]+/, '').trim())
    .filter(l => l.length > 0)
    .slice(0, 3)
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
    .map(d => ({ name: d.name }))
}

export function parseAnalysis(text) {
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
