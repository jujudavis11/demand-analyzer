export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { content, lens } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  const incomingPrompt = `You are a senior bodily injury claims adjuster with 10+ years evaluating PI demand letters for an insurance carrier. You have deep experience spotting inflated damages, weak liability, and demands that can be negotiated down vs those that need to settle or escalate.

Analyze this demand letter from the INCOMING/DEFENSE perspective.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "demand_strength": <1-100, how strong is the plaintiff's case>,
  "triage": "<DESK SETTLEMENT | SENIOR ADJUSTER | LITIGATION>",
  "liability_score": <1-10>,
  "damages_score": <1-10>,
  "summary": "<2-3 sentence executive summary for the adjuster>",
  "strengths": ["<what makes this demand strong>"],
  "weaknesses": ["<what can be challenged or negotiated>"],
  "missing_docs": ["<what plaintiff failed to include>"],
  "red_flags": ["<inflation signals, gaps, inconsistencies>"],
  "settlement_posture": "<recommended approach: low offer, counter, policy limits, etc.>",
  "adjuster_notes": "<tactical intelligence for the file handler>"
}

Demand letter:
${content.substring(0, 6000)}`;

  const outgoingPrompt = `You are a senior plaintiff's PI attorney doing a final review of a demand letter BEFORE it goes to the insurance carrier. Your job is to stress-test it the way an experienced adjuster will — find every hole, missing doc, and weak argument before it leaves your office.

Analyze this demand letter from the OUTGOING/PLAINTIFF perspective.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "send_readiness": <1-100, how ready is this to send>,
  "verdict": "<READY TO SEND | NEEDS REVISION | DO NOT SEND>",
  "liability_score": <1-10>,
  "damages_score": <1-10>,
  "summary": "<2-3 sentence assessment>",
  "strengths": ["<what will hold up under scrutiny>"],
  "gaps": ["<holes the adjuster will exploit>"],
  "missing_docs": ["<what needs to be attached or obtained>"],
  "adjuster_will_attack": ["<specific arguments the carrier will use against this>"],
  "before_you_send": "<concrete action items to strengthen this demand>",
  "attorney_notes": "<strategic notes on valuation and negotiation posture>"
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
        max_tokens: 2000,
        messages: [{ role: 'user', content: lens === 'incoming' ? incomingPrompt : outgoingPrompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: clean });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
