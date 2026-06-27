import { useState, useRef } from "react";
import { getPdfPageCount, splitPdfToChunks, MAX_PAGES_PER_CHUNK } from "./pdfChunker";

const NAV_BG = "#080C12";
const BLUE = "#1A6BFF";
const BLUE_DARK = "#185FA5";
const BLUE_LIGHT = "#E6F1FB";
const GREEN = "#0F6E56";
const GREEN_LIGHT = "#E1F5EE";

const COLORS = {
  incoming: { bg: BLUE_LIGHT, border: BLUE_DARK, text: "#0C447C", btn: BLUE_DARK, badge: "#B5D4F4", badgeText: "#042C53" },
  outgoing: { bg: GREEN_LIGHT, border: GREEN, text: "#085041", btn: GREEN, badge: "#9FE1CB", badgeText: "#04342C" },
};

const LOADING_MSGS = [
  "Reading uploaded documents...",
  "Cross-referencing medical records...",
  "Reviewing billing and wage loss docs...",
  "Scoring liability factors...",
  "Generating triage assessment...",
];

const MAX_FILES = 12;
const MAX_FILE_MB = 15;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.substring(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [lens, setLens] = useState("incoming");
  const [text, setText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]); // [{name, type, rawFile, pageCount, sizeLabel}]
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const intervalRef = useRef();

  function handleLens(l) { setLens(l); setResult(null); setError(""); }

  async function handleFiles(e) {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;
    setError("");

    if (uploadedFiles.length + incoming.length > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} files at once.`);
      return;
    }

    const accepted = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not a supported file type. Use PDF, JPG, PNG, or WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`"${file.name}" is too large. Max file size is ${MAX_FILE_MB}MB.`);
        continue;
      }
      accepted.push(file);
    }

    const converted = await Promise.all(
      accepted.map(async (file) => {
        let pageCount = null;
        if (file.type === "application/pdf") {
          try {
            pageCount = await getPdfPageCount(file);
          } catch (err) {
            pageCount = null;
          }
        }
        return {
          name: file.name,
          type: file.type,
          rawFile: file,
          pageCount,
          sizeLabel: file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`,
        };
      })
    );

    setUploadedFiles((prev) => [...prev, ...converted]);
    e.target.value = "";
  }

  function removeFile(idx) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function analyze() {
    if (!text.trim() && uploadedFiles.length === 0) {
      setError("Please paste demand letter text or upload at least one file.");
      return;
    }
    setError(""); setResult(null); setLoading(true);
    let mi = 0; setLoadingMsg(LOADING_MSGS[0]);
    intervalRef.current = setInterval(() => {
      mi = (mi + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[mi]);
    }, 2500);

    try {
      const oversizedPdf = uploadedFiles.find(
        (f) => f.type === "application/pdf" && f.pageCount && f.pageCount > MAX_PAGES_PER_CHUNK
      );

      let payload;

      if (oversizedPdf) {
        setLoadingMsg(`Splitting ${oversizedPdf.pageCount}-page PDF into sections...`);
        const chunks = await splitPdfToChunks(oversizedPdf.rawFile);

        const otherFiles = await Promise.all(
          uploadedFiles
            .filter((f) => f !== oversizedPdf)
            .map(async (f) => ({
              name: f.name,
              type: f.type,
              data: await fileToBase64(f.rawFile),
            }))
        );

        payload = {
          mode: "chunked",
          lens,
          content: text,
          files: otherFiles,
          chunks,
        };
      } else {
        const files = await Promise.all(
          uploadedFiles.map(async (f) => ({
            name: f.name,
            type: f.type,
            data: await fileToBase64(f.rawFile),
          }))
        );
        payload = { mode: "single", lens, content: text, files };
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      setResult(data);
    } catch (err) {
      setError(err.message || "Connection error. Please try again.");
    } finally {
      clearInterval(intervalRef.current);
      setLoading(false);
    }
  }

  const c = COLORS[lens];
  const isIn = lens === "incoming";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <header style={{ background: NAV_BG, borderBottom: `1px solid #1a2235`, padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src="/aaa-logo.png" alt="AI Arsenal Activators" style={{ height: 58, width: "auto" }} />
          <div style={{ width: 1, height: 36, background: "#2a3550" }} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
              DEMAND<span style={{ color: BLUE, textShadow: "0 0 20px #1A6BFF88" }}>360</span>
            </div>
            <div style={{ fontSize: 10, color: "#5a8fd4", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 3, fontWeight: 500 }}>AI Demand Intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: "#3a4a62", textAlign: "right", lineHeight: 1.4 }}>
            Powered by<br/><span style={{ color: "#5a8fd4", fontWeight: 600 }}>AI Arsenal Activators</span>
          </div>
          <span style={{ background: "#0d1525", border: "1px solid #1e2d45", borderRadius: 4, padding: "3px 10px", color: "#5a8fd4", fontSize: 11 }}>Beta</span>
        </div>
      </header>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* Hero */}
        <div style={{ marginBottom: "2rem", paddingTop: "0.5rem" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0d1525", margin: 0, letterSpacing: "-0.02em" }}>
            Demand Package Analyzer
          </h1>
          <p style={{ fontSize: 15, color: "#5a6a82", marginTop: 6, lineHeight: 1.5 }}>
            Upload the full package — cover letter, medical records, bills, police report, photos — or paste text. Built by a BI adjuster, for claims professionals.
          </p>
        </div>

        {/* Lens Toggle */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
          {[
            {
              id: "incoming", icon: "📥",
              label: "Incoming demand review",
              desc: "Score the demand, surface weaknesses, route to the right level",
              who: "Adjusters · Defense attorneys · Carriers",
            },
            {
              id: "outgoing", icon: "📤",
              label: "Outgoing demand check",
              desc: "Find gaps before it goes out — see it the way the adjuster will",
              who: "PI attorneys · Paralegals · Legal staff",
            },
          ].map((opt) => {
            const active = lens === opt.id;
            const col = COLORS[opt.id];
            return (
              <button key={opt.id} onClick={() => handleLens(opt.id)} style={{
                padding: "16px 18px", borderRadius: 10,
                border: active ? `2px solid ${col.border}` : "1.5px solid #dce3ed",
                background: active ? col.bg : "#fff",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                boxShadow: active ? `0 0 0 3px ${col.border}22` : "none",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? col.text : "#1a2235", marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: active ? col.text : "#6a7a92", opacity: active ? 0.85 : 1, lineHeight: 1.4, marginBottom: 10 }}>{opt.desc}</div>
                <div style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "inline-block",
                  background: active ? col.badge : "#eef1f6",
                  color: active ? col.badgeText : "#5a6a82",
                  letterSpacing: "0.02em",
                }}>{opt.who}</div>
              </button>
            );
          })}
        </div>

        {/* File Upload Zone */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${uploadedFiles.length ? c.border : "#cbd5e3"}`,
            borderRadius: 10, padding: "20px",
            background: uploadedFiles.length ? c.bg : "#fafbfd",
            cursor: "pointer", textAlign: "center",
            marginBottom: 12, transition: "all 0.15s",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleFiles}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2235" }}>
            Click to upload demand package files
          </div>
          <div style={{ fontSize: 12, color: "#8a96ab", marginTop: 4 }}>
            PDFs, photos, scans — any size PDF is fine, large ones are automatically split for processing. Up to {MAX_FILES} files, {MAX_FILE_MB}MB each.
          </div>
        </div>

        {/* Uploaded file list */}
        {uploadedFiles.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {uploadedFiles.map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 8, fontSize: 13,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  <span>{f.type === "application/pdf" ? "📄" : "🖼️"}</span>
                  <span style={{ color: "#1a2235", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                  <span style={{ color: "#9aa5b8", fontSize: 11, flexShrink: 0 }}>{f.sizeLabel}</span>
                  {f.pageCount && f.pageCount > MAX_PAGES_PER_CHUNK && (
                    <span style={{ color: "#d97706", fontSize: 11, flexShrink: 0, fontWeight: 600 }}>
                      {f.pageCount} pages · will auto-split
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{ border: "none", background: "none", color: "#9aa5b8", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input */}
        <div style={{ position: "relative" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Optionally paste additional text here — cover letter, notes, anything not already covered by your uploaded files..."
            style={{
              width: "100%", minHeight: 120, padding: "14px 16px",
              fontSize: 14, fontFamily: "inherit",
              border: "1.5px solid #dce3ed", borderRadius: 10,
              resize: "vertical", outline: "none",
              boxSizing: "border-box", color: "#1a2235",
              background: "#fff", lineHeight: 1.6,
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = BLUE}
            onBlur={e => e.target.style.borderColor = "#dce3ed"}
          />
          {text && (
            <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 11, color: "#9aa5b8" }}>
              {text.length.toLocaleString()} characters
            </div>
          )}
        </div>

        {/* Analyze Button */}
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            width: "100%", padding: "15px",
            marginTop: 12, borderRadius: 10, border: "none",
            background: loading ? "#9aa5b8" : c.btn,
            color: "#fff", fontSize: 16, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s", letterSpacing: "-0.01em",
            boxShadow: loading ? "none" : `0 2px 12px ${c.btn}44`,
          }}
        >
          {loading ? `⏳ ${loadingMsg}` : isIn ? "🔍 Run incoming demand review" : "🔍 Run outgoing demand check"}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {result && <ResultCard result={result} lens={lens} />}

      </div>

      {/* Footer */}
      <footer style={{ background: NAV_BG, borderTop: "1px solid #1a2235", padding: "1.5rem 2rem", marginTop: "auto" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#4a5a78" }}>
              © 2025 <span style={{ color: BLUE }}>AI Arsenal Activators</span> · Demand360 · All rights reserved
            </div>
            <div style={{ fontSize: 11, color: "#3a4a62", maxWidth: 520, lineHeight: 1.5 }}>
              This platform does not store, retain, or share uploaded content. All analysis is processed in real time and discarded. Enterprise data processing agreements available upon request.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

function QuickGlance({ data, isIn }) {
  if (!data) return null;
  const fields = isIn ? [
    { label: "Total demand", value: data.total_demand },
    { label: "Settlement deadline", value: data.settlement_deadline, urgent: true },
    { label: "Medical specials", value: data.total_medical_specials },
    { label: "Wage loss", value: data.total_wage_loss },
    { label: "Treatment duration", value: data.treatment_duration },
    { label: "Gaps in treatment", value: data.gaps_in_treatment, warn: true },
    { label: "Recommended reserve", value: data.recommended_reserve, highlight: true },
    { label: "Venue", value: data.venue },
    { label: "Policy limits", value: data.policy_limits },
    { label: "# of plaintiffs", value: data.num_plaintiffs },
    { label: "Plaintiff counsel", value: data.plaintiff_counsel },
  ] : [
    { label: "Demand amount", value: data.total_demand },
    { label: "Settlement deadline", value: data.settlement_deadline, urgent: true },
    { label: "Medical specials", value: data.total_medical_specials },
    { label: "Wage loss", value: data.total_wage_loss },
    { label: "Treatment duration", value: data.treatment_duration },
    { label: "Gaps (adjuster will flag)", value: data.gaps_in_treatment, warn: true },
    { label: "Carrier will reserve at", value: data.recommended_reserve },
    { label: "Venue", value: data.venue },
    { label: "Policy limits", value: data.policy_limits },
    { label: "# of plaintiffs", value: data.num_plaintiffs },
    { label: "Your firm", value: data.plaintiff_counsel },
  ];

  return (
    <div style={{ marginBottom: "1.25rem", background: "#f0f5ff", border: "1.5px solid #c5d5f5", borderRadius: 10, padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
        ⚡ Quick Glance
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: "10px 20px" }}>
        {fields.map((f, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: "#7a8ba8", marginBottom: 2, letterSpacing: "0.02em" }}>{f.label}</div>
            <div style={{
              fontSize: 13, fontWeight: 600, lineHeight: 1.4,
              color: f.highlight ? "#c2410c" : f.warn ? "#92400e" : f.urgent ? "#1a6bff" : "#1a2235"
            }}>
              {f.value || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ result, lens }) {
  const isIn = lens === "incoming";
  const c = COLORS[lens];
  const mainScore = isIn ? result.demand_strength : result.send_readiness;
  const verdict = isIn ? result.triage : result.verdict;

  const verdictStyle = () => {
    const v = verdict || "";
    if (v.includes("LITIGATION") || v.includes("DO NOT")) return { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" };
    if (v.includes("SENIOR") || v.includes("REVISION")) return { bg: "#fffbeb", color: "#92400e", border: "#fde68a" };
    return { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
  };
  const vs = verdictStyle();
  const scoreColor = mainScore >= 70 ? "#dc2626" : mainScore >= 40 ? "#d97706" : "#16a34a";

  const Section = ({ label, items, accent }) => items && items.length > 0 ? (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#7a8ba8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{
            fontSize: 13, color: "#2a3550", padding: "5px 0 5px 12px",
            borderLeft: `2.5px solid ${accent}`, marginBottom: 5, lineHeight: 1.5
          }}>{item}</li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div style={{ marginTop: "1.5rem", background: "#fff", border: "1px solid #dce3ed", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 16px #1a22350d" }}>

      {/* Result Header Bar */}
      <div style={{ background: NAV_BG, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {isIn ? "📥 Incoming Demand Review" : "📤 Outgoing Demand Check"}
        </div>
        <div style={{ fontSize: 11, color: "#4a5a78" }}>Demand360 · AI Arsenal Activators</div>
      </div>

      <div style={{ padding: "1.5rem" }}>

        <QuickGlance data={result.quick_glance} isIn={isIn} />

        {/* Score Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.25rem" }}>
          <div style={{ background: "#f4f6f9", borderRadius: 8, padding: "14px 10px", textAlign: "center", border: "1px solid #eaeef4" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{mainScore}</div>
            <div style={{ fontSize: 11, color: "#7a8ba8", marginTop: 4 }}>{isIn ? "Demand strength" : "Send readiness"}</div>
          </div>
          <div style={{ background: "#f4f6f9", borderRadius: 8, padding: "14px 10px", textAlign: "center", border: "1px solid #eaeef4" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1a2235", lineHeight: 1 }}>{result.liability_score}<span style={{ fontSize: 13, color: "#9aa5b8" }}>/10</span></div>
            <div style={{ fontSize: 11, color: "#7a8ba8", marginTop: 4 }}>Liability</div>
          </div>
          <div style={{ background: "#f4f6f9", borderRadius: 8, padding: "14px 10px", textAlign: "center", border: "1px solid #eaeef4" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1a2235", lineHeight: 1 }}>{result.damages_score}<span style={{ fontSize: 13, color: "#9aa5b8" }}>/10</span></div>
            <div style={{ fontSize: 11, color: "#7a8ba8", marginTop: 4 }}>Damages</div>
          </div>
          <div style={{ background: vs.bg, borderRadius: 8, padding: "14px 10px", textAlign: "center", border: `1px solid ${vs.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: vs.color, lineHeight: 1.3 }}>{verdict}</div>
            <div style={{ fontSize: 11, color: "#7a8ba8", marginTop: 4 }}>{isIn ? "Routing" : "Verdict"}</div>
          </div>
        </div>

        {/* Summary */}
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: "#2a3550",
          padding: "14px 16px", background: "#f8fafc",
          borderRadius: 8, marginBottom: "1.25rem",
          borderLeft: `3px solid ${BLUE}`,
        }}>{result.summary}</p>

        {/* Cross-document issues */}
        <Section label="⚠️ Cross-Document Inconsistencies" items={result.cross_document_issues} accent="#dc2626" />

        {/* Two column */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "0.5rem" }}>
          <Section label="Strengths" items={result.strengths} accent="#16a34a" />
          <Section label={isIn ? "Weaknesses to challenge" : "Gaps adjuster will exploit"} items={isIn ? result.weaknesses : result.gaps} accent="#dc2626" />
        </div>

        <Section label={isIn ? "Red flags" : "Adjuster will attack"} items={isIn ? result.red_flags : result.adjuster_will_attack} accent="#d97706" />
        <Section label="Missing documentation" items={result.missing_docs} accent="#9aa5b8" />

        {(isIn ? result.settlement_posture : result.before_you_send) && (
          <div style={{ padding: "13px 16px", background: "#f8fafc", borderRadius: 8, fontSize: 13, color: "#2a3550", marginBottom: "1rem", borderLeft: `3px solid ${GREEN}` }}>
            <strong style={{ color: "#1a2235" }}>{isIn ? "Settlement posture:" : "Before you send:"}</strong>{" "}
            {isIn ? result.settlement_posture : result.before_you_send}
          </div>
        )}

        {(isIn ? result.adjuster_notes : result.attorney_notes) && (
          <div style={{ fontSize: 13, color: "#5a6a82", borderTop: "1px solid #eaeef4", paddingTop: "1rem" }}>
            <strong style={{ color: "#1a2235" }}>{isIn ? "Adjuster notes:" : "Attorney notes:"}</strong>{" "}
            {isIn ? result.adjuster_notes : result.attorney_notes}
          </div>
        )}

      </div>
    </div>
  );
}
