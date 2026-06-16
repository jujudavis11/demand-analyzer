export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { content, lens } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  const incomingPrompt = `You are a senior bodily injury claims adjuster with 10+ years evaluating PI demand letters for an insurance carrier.

Analyze this demand letter from the INCOMING/DEFENSE perspective.

You MUST respond with ONLY a valid JSON object. No explanation, no markdown, no backticks. Start with { and end with }.

{
  "quick_glance": {
    "total_demand": "<dollar amount demanded for settlement, or 'Not stated'>",
    "settlement_deadline": "<deadline date or 'Not stated'>",
    "total_medical_specials": "<total past medical expenses, or 'Not stated'>",
    "total_wage_loss": "<past and future wage loss combined, or 'Not stated'>",
    "treatment_duration": "<how long plaintiff treated, e.g. '6 months' or 'Not stated'>",
    "gaps_in_treatment": "<any gaps noted, or 'None identified'>",
    "recommended_reserve": "<your reserve recommendation as adjuster>",
    "venue": "<jurisdiction or court venue, or 'Not stated'>",
    "policy_limits": "<policy limits referenced, or 'Not stated'>",
    "num_plaintiffs": "<number of plaintiffs>",
    "plaintiff_counsel": "<law firm or attorney name, or 'Not stated'>"
  },
  "demand_strength": <1-100>,
  "triage": "<DESK SETTLEMENT or SENIOR ADJUSTER or LITIGATION>",
  "liability_score": <1-10>,
  "damages_score": <1-10>,
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<item>", "<item>", "<item>"],
  "weaknesses": ["<item>", "<item>", "<item>"],
  "missing_docs": ["<item>", "<item>"],
  "red_flags": ["<item>", "<item>"],
  "settlement_posture": "<recommended approach>",
  "adjuster_notes": "<tactical notes>"
}

Demand letter:
${content.substring(0, 12000)}`;

  const outgoingPrompt = `You are a senior plaintiff's PI attorney reviewing a demand letter before it goes to the insurance carrier.

Analyze this demand letter from the OUTGOING/PLAINTIFF perspective.

You MUST respond with ONLY a valid JSON object. No explanation, no markdown, no backticks. Start with { and end with }.

{
  "quick_glance": {
    "total_demand": "<dollar amount being demanded>",
    "settlement_deadline": "<deadline stated in letter, or 'Not stated'>",
    "total_medical_specials": "<total medical expenses claimed>",
    "total_wage_loss": "<wage loss claimed, or 'Not stated'>",
    "treatment_duration": "<length of treatment>",
    "gaps_in_treatment": "<any gaps that adjuster will flag, or 'None identified'>",
    "recommended_reserve": "<what the carrier will likely reserve at>",
    "venue": "<jurisdiction>",
    "policy_limits": "<policy limits referenced>",
    "num_plaintiffs": "<number of plaintiffs>",
    "plaintiff_counsel": "<your firm name as it appears>"
  },
  "send_readiness": <1-100>,
  "verdict": "<READY TO SEND or NEEDS REVISION or DO NOT SEND>",
  "liability_score": <1-10>,
  "damages_score": <1-10>,
  "summary": "<2-3 sentence assessment>",
  "strengths": ["<item>", "<item>", "<item>"],
  "gaps": ["<item>", "<item>", "<item>"],
  "missing_docs": ["<item>", "<item>"],
  "adjuster_will_attack": ["<item>", "<item>"],
  "before_you_send": "<action items>",
  "attorney_notes": "<strategic notes>"
}

Demand letter:
${content.substring(0, 12000)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: lens === 'incoming' ? incomingPrompt : outgoingPrompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });

    const raw = data.content.map(i => i.text || '').join('');
    let parsed = null;
    try { parsed = JSON.parse(raw.trim()); } catch(e) {}
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch(e) {} }
    }
    if (parsed) return res.status(200).json(parsed);
    return res.status(500).json({ error: 'Failed to parse AI response', raw: raw.substring(0, 200) });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
