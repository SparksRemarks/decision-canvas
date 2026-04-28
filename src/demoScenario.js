// Pre-loaded fallback scenario for the live demo. Lets Chris skip Steps 1-3
// straight to the ratings reveal if API calls are flaky on stage.
//
// Tuned for Series A SaaS founders: $1-5M ARR, high margin, near break-even,
// 15-30 employees, 9-18 months runway. The scenario is designed to produce
// a strong prediction-vs-actual surprise: the founder's gut says "go upmarket"
// but the numbers reveal that the bottleneck is actually founder time, and
// "hire a VP of Sales" wins by quietly dominating every factor.

export const DEMO_SCENARIO = {
  decision:
    "We just hit $3M ARR. SMB customers love us but growth is slowing. Do we move upmarket to mid-market, hire a VP of Sales to scale what's working, or raise a Series B and scale across the board?",

  context:
    "$3M ARR, 78% gross margin, growing 8% MoM but decelerating. 22 employees. 14 months of runway at current burn. Two senior reps drove ~60% of last quarter's revenue. CEO is still doing top-of-funnel. Three Series B firms have reached out unsolicited.",

  framing:
    "You're choosing between scaling by going upmarket, scaling by hiring a leader, or scaling by raising more capital. The core tension is that each path solves a different bottleneck — and each one resets a different clock you can't unstart.",

  options: [
    'Move upmarket to mid-market deals',
    'Hire a VP of Sales to systematize the motion',
    'Raise a Series B and scale broadly'
  ],

  missingOption:
    "Productize the founder-led motion — extract the playbook your two senior reps already use into something repeatable, before hiring above them or moving upmarket.",

  // Founder predicts "Move upmarket" — biggest TAM, sexiest narrative.
  // The numbers will say "Hire a VP of Sales" wins. That's the demo moment.
  predictedTopId: 1,

  dimensions: [
    { name: 'Capital efficiency' },
    { name: 'Founder leverage' },
    { name: 'Compounding distribution' },
    { name: 'Reversibility' }
  ],

  // All factors framed so 5 = best.
  // Designed so option 2 (VP of Sales) wins clearly, option 1 (upmarket) is
  // a high-ceiling but low-floor surprise runner-up, and option 3 (raise) is
  // last because of dilution + burn-rate spike + irreversibility.
  ratings: {
    1: { 0: 2, 1: 2, 2: 4, 3: 2 }, // Move upmarket: 4+4+16+4 = 28
    2: { 0: 4, 1: 5, 2: 4, 3: 4 }, // Hire VP of Sales: 16+25+16+16 = 73
    3: { 0: 1, 1: 3, 2: 3, 3: 1 }  // Raise Series B: 1+9+9+1 = 20
  }
}
