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

You MUST respond with ONLY a valid JSON object. No explanation, no markdown, no backticks. Start your response with { and end with }.

{
  "demand_strength": <number 1-100>,
  "triage": "<DESK SETTLEMENT or SENIOR ADJUSTER or LITIGATION>",
  "liability_score": <number 1-10>,
  "damages_score": <number 1-10>,
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<item>", "<item>", "<item>"],
  "weaknesses": ["<item>", "<item>", "<item>"],
  "missing_docs": ["<item>", "<item>"],
  "red_flags": ["<item>", "<item>"],
  "settlement_posture": "<recommended approach>",
  "adjuster_notes": "<tactical notes>"
}

Demand letter:
${content.substring(0, 6000)}`;

  const outgoingPrompt = `You are a senior plaintiff's PI attorney reviewing a demand letter before it goes to the insurance carrier.

Analyze this demand letter from the OUTGOING/PLAINTIFF perspective.

You MUST respond with ONLY a valid JSON object. No explanation, no markdown, no backticks. Start your response with { and end with }.

{
  "send_readiness": <number 1-100>,
  "verdict": "<READY TO SEND or NEEDS REVISION or DO NOT SEND>",
  "liability_score": <number 1-10>,
  "damages_score": <number 1-10>,
  "summary": "<2-3 sentence assessment>",
  "strengths": ["<item>", "<item>", "<item>"],
  "gaps": ["<item>", "<item>", "<item>"],
  "missing_docs": ["<item>", "<item>"],
  "adjuster_will_attack": ["<item>", "<item>"],
  "before_you_send": "<action items>",
  "attorney_notes": "<strategic notes>"
}

Demand letter:
${content.substring(0, 6000)}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: lens === 'incoming' ? incomingPrompt : outgoingPrompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    const raw = data.content.map(i => i.text || '').join('');
    
    let parsed = null;
    
    // Strategy 1: direct parse after stripping markdown
    try { 
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); 
    } catch(e) {}
    
    // Strategy 2: extract first JSON object found
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch(e) {}
      }
    }

    if (parsed) {
      return res.status(200).json(parsed);
    } else {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
