// /api/analyze.js
// Supports two modes:
//  1. "single" - small packages (under ~90 pages total) - one API call, same as before
//  2. "chunked" - large PDFs pre-split client-side into <=90-page pieces.
//     Each chunk is analyzed separately (map), then synthesized into one final result (reduce).

const MODEL = "claude-opus-4-7"; // strongest reasoning model - used for accuracy on messy/large packages

async function callClaude(messageContent, maxTokens = 3000) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: messageContent }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "API error");
  return data.content.map((i) => i.text || "").join("");
}

function parseJsonLoose(raw) {
  try {
    return JSON.parse(raw.trim());
  } catch (e) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {}
  }
  return null;
}

const FINAL_SCHEMA_INCOMING = `{
  "quick_glance": {
    "total_demand": "<dollar amount demanded, or 'Not stated'>",
    "settlement_deadline": "<deadline date or 'Not stated'>",
    "total_medical_specials": "<total past medical expenses, or 'Not stated'>",
    "total_wage_loss": "<past and future wage loss combined, or 'Not stated'>",
    "treatment_duration": "<how long plaintiff treated, or 'Not stated'>",
    "gaps_in_treatment": "<any gaps noted, or 'None identified'>",
    "recommended_reserve": "<your reserve recommendation as adjuster>",
    "venue": "<jurisdiction or 'Not stated'>",
    "policy_limits": "<policy limits, or 'Not stated'>",
    "num_plaintiffs": "<number of plaintiffs>",
    "plaintiff_counsel": "<law firm/attorney, or 'Not stated'>"
  },
  "demand_strength": <1-100>,
  "triage": "<DESK SETTLEMENT or SENIOR ADJUSTER or LITIGATION>",
  "liability_score": <1-10>,
  "damages_score": <1-10>,
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<item>"],
  "weaknesses": ["<item>"],
  "missing_docs": ["<item>"],
  "red_flags": ["<item>"],
  "cross_document_issues": ["<contradictions found between documents/chunks>"],
  "settlement_posture": "<recommended approach>",
  "adjuster_notes": "<tactical notes>"
}`;

const FINAL_SCHEMA_OUTGOING = `{
  "quick_glance": {
    "total_demand": "<dollar amount being demanded>",
    "settlement_deadline": "<deadline, or 'Not stated'>",
    "total_medical_specials": "<total medical expenses claimed>",
    "total_wage_loss": "<wage loss claimed, or 'Not stated'>",
    "treatment_duration": "<length of treatment>",
    "gaps_in_treatment": "<gaps adjuster will flag, or 'None identified'>",
    "recommended_reserve": "<what the carrier will likely reserve at>",
    "venue": "<jurisdiction>",
    "policy_limits": "<policy limits referenced>",
    "num_plaintiffs": "<number of plaintiffs>",
    "plaintiff_counsel": "<your firm name>"
  },
  "send_readiness": <1-100>,
  "verdict": "<READY TO SEND or NEEDS REVISION or DO NOT SEND>",
  "liability_score": <1-10>,
  "damages_score": <1-10>,
  "summary": "<2-3 sentence assessment>",
  "strengths": ["<item>"],
  "gaps": ["<item>"],
  "missing_docs": ["<item>"],
  "adjuster_will_attack": ["<item>"],
  "cross_document_issues": ["<contradictions found between documents/chunks>"],
  "before_you_send": "<action items>",
  "attorney_notes": "<strategic notes>"
}`;

function buildSingleInstructions(lens) {
  const role =
    lens === "incoming"
      ? "You are a senior bodily injury claims adjuster with 10+ years evaluating PI demand letters for an insurance carrier. Analyze this demand package from the INCOMING/DEFENSE perspective."
      : "You are a senior plaintiff's PI attorney reviewing a demand package before it goes to the insurance carrier. Analyze this demand package from the OUTGOING/PLAINTIFF perspective.";
  const schema = lens === "incoming" ? FINAL_SCHEMA_INCOMING : FINAL_SCHEMA_OUTGOING;
  return `${role}

You will be given a FULL DEMAND PACKAGE: cover letter, medical records, bills, wage loss docs, police reports, photos, etc. These may be messy or disorganized — that's normal. Cross-reference ALL materials and flag contradictions between documents (dates, amounts, names that don't match).

Respond with ONLY a valid JSON object, no markdown, no backticks. Start with { and end with }.

${schema}`;
}

// MAP step: extract raw findings from one chunk of a large PDF. This chunk may not contain
// the whole picture, so it should report only what IS findable in this chunk, not guess.
function buildChunkExtractionPrompt(lens, chunkIndex, totalChunks) {
  return `You are a senior BI claims adjuster reviewing PART ${chunkIndex} of ${totalChunks} of a large, multi-part demand package PDF. This is only one section of the full document — other sections are being reviewed separately.

Read this section carefully and extract ONLY what is actually present in THIS section. Do not guess or assume information from sections you haven't seen.

Respond with ONLY valid JSON, no markdown:
{
  "chunk_index": ${chunkIndex},
  "document_types_seen": ["<e.g. 'medical records', 'billing ledger', 'police report', 'cover letter'>"],
  "dollar_amounts_found": ["<any specific dollar amounts and what they relate to>"],
  "dates_found": ["<any specific dates and what they relate to, e.g. treatment dates, accident date>"],
  "names_found": ["<plaintiff names, provider names, attorney names found in this section>"],
  "key_facts": ["<notable facts: diagnoses, treatment gaps, statements, liability-relevant facts>"],
  "potential_red_flags": ["<anything that looks like an inconsistency, inflation, or fraud indicator within just this section>"],
  "raw_notes": "<anything else relevant a senior adjuster would want carried forward to final analysis>"
}`;
}

function buildSynthesisPrompt(lens, chunkExtractions, otherContext) {
  const role =
    lens === "incoming"
      ? "You are a senior bodily injury claims adjuster with 10+ years evaluating PI demand letters for an insurance carrier. You are producing the FINAL analysis from the INCOMING/DEFENSE perspective."
      : "You are a senior plaintiff's PI attorney finalizing review of a demand package before it goes to the insurance carrier. You are producing the FINAL analysis from the OUTGOING/PLAINTIFF perspective.";
  const schema = lens === "incoming" ? FINAL_SCHEMA_INCOMING : FINAL_SCHEMA_OUTGOING;

  return `${role}

A large demand package PDF was too long to read in one pass, so it was split into ${chunkExtractions.length} sections and each was reviewed separately. Below are the extracted findings from every section, in order. Synthesize ALL of these into ONE unified final analysis. Pay special attention to contradictions ACROSS sections (e.g. a dollar amount in one section that doesn't match another, a date inconsistency, a name mismatch) — these go in "cross_document_issues".

SECTION EXTRACTIONS:
${JSON.stringify(chunkExtractions, null, 2)}

${otherContext ? `ADDITIONAL CONTEXT (other uploaded files / pasted text):\n${otherContext}\n` : ""}

Respond with ONLY a valid JSON object, no markdown, no backticks. Start with { and end with }.

${schema}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { mode, content, lens, files, chunks } = req.body;

  try {
    // ---------- MODE: single (small/normal packages, <=~90 pages total) ----------
    if (mode !== "chunked") {
      const hasText = content && content.trim().length > 0;
      const hasFiles = Array.isArray(files) && files.length > 0;
      if (!hasText && !hasFiles) {
        return res.status(400).json({ error: "No content or files provided" });
      }

      const messageContent = [{ type: "text", text: buildSingleInstructions(lens) }];

      if (hasFiles) {
        for (const file of files) {
          if (!file.data || !file.type) continue;
          if (file.type === "application/pdf") {
            messageContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } });
          } else if (file.type.startsWith("image/")) {
            messageContent.push({ type: "image", source: { type: "base64", media_type: file.type, data: file.data } });
          }
          messageContent.push({ type: "text", text: `(The above file is named: ${file.name})` });
        }
      }
      if (hasText) {
        messageContent.push({ type: "text", text: `Additional pasted text:\n${content.substring(0, 12000)}` });
      }

      const raw = await callClaude(messageContent, 3000);
      const parsed = parseJsonLoose(raw);
      if (!parsed) return res.status(500).json({ error: "Failed to parse AI response", raw: raw.substring(0, 200) });
      return res.status(200).json(parsed);
    }

    // ---------- MODE: chunked (large PDF, pre-split client-side) ----------
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: "No chunks provided for chunked mode" });
    }

    // MAP: extract findings from each chunk sequentially (sequential = simpler, avoids rate-limit bursts)
    const extractions = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const messageContent = [
        { type: "text", text: buildChunkExtractionPrompt(lens, i + 1, chunks.length) },
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: chunk.data } },
      ];
      const raw = await callClaude(messageContent, 1500);
      const parsed = parseJsonLoose(raw) || { chunk_index: i + 1, raw_notes: raw.substring(0, 500) };
      extractions.push(parsed);
    }

    // Fold in any other uploaded files (images, smaller PDFs) + pasted text as plain context for synthesis
    let otherContext = "";
    if (Array.isArray(files) && files.length > 0) {
      otherContext += `Other uploaded files (names only, not re-processed in synthesis): ${files.map((f) => f.name).join(", ")}\n`;
    }
    if (content && content.trim().length > 0) {
      otherContext += `Pasted text:\n${content.substring(0, 8000)}`;
    }

    // REDUCE: synthesize all chunk extractions into one final structured result
    const synthesisPrompt = buildSynthesisPrompt(lens, extractions, otherContext);
    const finalRaw = await callClaude([{ type: "text", text: synthesisPrompt }], 3000);
    const finalParsed = parseJsonLoose(finalRaw);
    if (!finalParsed) {
      return res.status(500).json({ error: "Failed to parse final synthesis", raw: finalRaw.substring(0, 200) });
    }
    return res.status(200).json(finalParsed);
  } catch (err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
