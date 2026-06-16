export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { content, lens } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });
  const prompt = lens === 'incoming'
    ? `You are a senior BI claims adjuster. Analyze this demand letter. Reply with ONLY a JSON object, nothing else before or after it:\n{"demand_strength":75,"triage":"DESK SETTLEMENT","liability_score":7,"damages_score":6,"summary":"brief summary here","strengths":["item"],"weaknesses":["item"],"missing_docs":["item"],"red_flags":["item"],"settlement_posture":"posture here","adjuster_notes":"notes here"}\n\nDemand:\n${content.substring(0, 12000)}`
    : `You are a senior PI attorney. Analyze this demand letter. Reply with ONLY a JSON object, nothing else before or after it:\n{"send_readiness":75,"verdict":"NEEDS REVISION","liability_score":7,"damages_score":6,"summary":"brief summary here","strengths":["item"],"gaps":["item"],"missing_docs":["item"],"adjuster_will_attack":["item"],"before_you_send":"action items here","attorney_notes":"notes here"}\n\nDemand:\n${content.substring(0, 12000)}`;
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
        messages: [{ role: 'user', content: prompt }]
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
