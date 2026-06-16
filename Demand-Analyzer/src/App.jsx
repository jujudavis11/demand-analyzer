import { useState, useRef } from "react";

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
  "Analyzing demand letter...",
  "Reviewing medical documentation...",
  "Scoring liability factors...",
  "Generating triage assessment...",
];

export default function App() {
  const [lens, setLens] = useState("incoming");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const intervalRef = useRef();

  function handleLens(l) { setLens(l); setResult(null); setError(""); }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFilename(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result);
    reader.readAsText(file);
  }

  async function analyze() {
    if (!text.trim()) { setError("Please paste demand letter text first."); return; }
    setError(""); setResult(null); setLoading(true);
    let mi = 0; setLoadingMsg(LOADING_MSGS[0]);
    intervalRef.current = setInterval(() => {
      mi = (mi + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[mi]);
    }, 2500);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, lens }),
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/aaa-logo.png" alt="AI Arsenal Activators" style={{ height: 44, width: "auto" }} />
          <div style={{ width: 1, height: 28, background: "#2a3550" }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Demand<span style={{ color: BLUE }}>360</span>
            </div>
            <div style={{ fontSize: 11, color: "#7a8ba8", letterSpacing: "0.04em", textTransform: "uppercase" }}>AI Demand Intelligence</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#4a5a78", textAlign: "right" }}>
          <span style={{ background: "#0d1525", border: "1px solid #1e2d45", borderRadius: 4, padding: "3px 10px", color: "#5a8fd4" }}>
            Beta
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* Hero */}
        <div style={{ marginBottom: "2rem", paddingTop: "0.5rem" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0d1525", margin: 0, letterSpacing: "-0.02em" }}>
            Demand Letter Analyzer
          </h1>
          <p style={{ fontSize: 15, color: "#5a6a82", marginTop: 6, lineHeight: 1.5 }}>
            AI-powered triage for incoming demands and outgoing demand checks. Built by a BI adjuster, for claims professionals.
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

        {/* Text Input */}
        <div style={{ position: "relative" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste demand letter text here — cover letter, medical summary, wage loss documentation..."
            style={{
              width: "100%", minHeight: 180, padding: "14px 16px",
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
