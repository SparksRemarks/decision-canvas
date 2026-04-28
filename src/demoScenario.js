// Pre-loaded fallback scenario for the live demo. Lets Chris skip Steps 1-3
// straight to the ratings reveal if API calls are flaky on stage.

export const DEMO_SCENARIO = {
  decision:
    "Should we expand to enterprise clients, raise prices on our current SMB base, or hire a sales lead to scale what's already working?",

  context:
    "We have 18 months of runway. Current SMB customers are happy but churn slowly on price increases. Two enterprise leads have come inbound but neither is qualified yet.",

  framing:
    "You're deciding whether to change WHO you sell to, what you charge them, or who does the selling. The core tension is that each path solves a different bottleneck — and you can only commit to one without diluting all three.",

  options: [
    'Expand to enterprise clients',
    'Raise prices on current SMB base',
    'Hire a senior sales lead'
  ],

  missingOption:
    "Productize the current motion — package the SMB offering tightly enough that it sells itself without a new segment, new pricing, or new headcount.",

  predictedTopId: 1, // user predicts "Expand to enterprise" will win

  dimensions: [
    { name: 'Speed to revenue' },
    { name: 'Founder leverage' },
    { name: 'Strategic optionality' },
    { name: 'Execution safety' }
  ],

  // ratings keyed by option id (matches options array index + 1)
  // 1 = low, 5 = high. All dimensions are framed so 5 is best.
  ratings: {
    1: { 0: 2, 1: 2, 2: 5, 3: 2 }, // Enterprise: slow, drains founder, opens doors, risky
    2: { 0: 5, 1: 4, 2: 2, 3: 4 }, // Raise prices: fast, low founder cost, low optionality, safe
    3: { 0: 3, 1: 5, 2: 4, 3: 3 }  // Sales lead: medium speed, frees founder, builds capability, hiring risk
  }
}
