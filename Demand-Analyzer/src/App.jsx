import { useState, useRef } from "react";

const COLORS = {
  incoming: { bg: "#E6F1FB", border: "#185FA5", text: "#0C447C", btn: "#185FA5", badge: "#B5D4F4", badgeText: "#042C53" },
  outgoing: { bg: "#E1F5EE", border: "#0F6E56", text: "#085041", btn: "#0F6E56", badge: "#9FE1CB", badgeText: "#04342C" },
};

const LOADING_MSGS = ["Analyzing demand letter...","Reviewing medical documentation...","Scoring liability factors...","Generating triage assessment..."];

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
    intervalRef.current = setInterval(() => { mi = (mi+1)%LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[mi]); }, 2500);
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
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#888", textTransform: "uppercase", marginBottom: 6 }}>AI Arsenal Activators</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#111", margin: 0 }}>Demand Letter Analyzer</h1>
          <p style={{ fontSize: 15, color: "#666", marginTop: 6 }}>AI-powered demand triage. Choose your direction to get the right analysis.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
          {[
            { id: "incoming", icon: "📥", label: "Incoming demand review", desc: "Score the demand, find weaknesses, route to the right level", who: "Adjusters · Defense attorneys · Carriers" },
            { id: "outgoing", icon: "📤", label: "Outgoing demand check", desc: "Find gaps before it goes out — see it how the adjuster will", who: "PI attorneys · Paralegals · Legal staff" },
          ].map((opt) => {
            const active = lens === opt.id;
            const col = COLORS[opt.id];
            return (
              <button key={opt.id} onClick={() => handleLens(opt.id)} style={{ padding: "16px", borderRadius: 10, border: active ? `2px solid ${col.border}` : "1.5px solid #ddd", background: active ? col.bg : "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? col.text : "#222", marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: active ? col.text : "#777", opacity: active ? 0.8 : 1, lineHeight: 1.4, marginBottom: 8 }}>{opt.desc}</div>
                <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, display: "inline-block", background: active ? col.badge : "#f0f0f0", color: active ? col.badgeText : "#666" }}>{opt.who}</div>
              </button>
            );
          })}
        </div>

        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste demand letter text here..." style={{ width: "100%", minHeight: 160, padding: 14, fontSize: 14, fontFamily: "inherit", border: "1.5px solid #ddd", borderRadius: 8, resize: "vertical", outline: "none", boxSizing: "border-box", color: "#222", background: "#fff" }} />

        <button onClick={analyze} disabled={loading} style={{ width: "100%", padding: "14px", marginTop: 12, borderRadius: 8, border: "none", background: loading ? "#aaa" : c.btn, color: "#fff", fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
          {loading ? loadingMsg : isIn ? "🔍 Run incoming demand review" : "🔍 Run outgoing demand check"}
        </button>

        {error && <div style={{ marginTop: 12, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 14 }}>⚠️ {error}</div>}
        {result && <ResultCard result={result} lens={lens} />}
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
    if (v.includes("LITIGATION") || v.includes("DO NOT")) return { bg: "#fef2f2", color: "#991b1b" };
    if (v.includes("SENIOR") || v.includes("REVISION")) return { bg: "#fffbeb", color: "#92400e" };
    return { bg: "#f0fdf4", color: "#166534" };
  };
  const vs = verdictStyle();
  const scoreColor = mainScore >= 70 ? "#dc2626" : mainScore >= 40 ? "#d97706" : "#16a34a";
  const Section = ({ label, items, accent }) => items && items.length > 0 ? (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, i) => <li key={i} style={{ fontSize: 13, color: "#333", padding: "4px 0 4px 12px", borderLeft: `2px solid ${accent}`, marginBottom: 4 }}>{item}</li>)}
      </ul>
    </div>
  ) : null;

  return (
    <div style={{ marginTop: "1.5rem", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.5rem" }}>
      <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, letterSpacing: "0.07em", marginBottom: "1rem", background: c.badge, color: c.badgeText }}>
        {isIn ? "INCOMING DEMAND REVIEW" : "OUTGOING DEMAND CHECK"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1rem" }}>
        {[
          { num: mainScore, label: isIn ? "Demand strength" : "Send readiness", color: scoreColor },
          { num: `${result.liability_score}/10`, label: "Liability", color: "#374151" },
          { num: `${result.damages_score}/10`, label: "Damages", color: "#374151" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.num}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: vs.color, background: vs.bg, padding: "4px 6px", borderRadius: 6, lineHeight: 1.3 }}>{verdict}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{isIn ? "Routing" : "Verdict"}</div>
        </div>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: "#374151", padding: "12px 14px", background: "#f9fafb", borderRadius: 8, marginBottom: "1rem" }}>{result.summary}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <Section label="Strengths" items={result.strengths} accent="#16a34a" />
        <Section label={isIn ? "Weaknesses to challenge" : "Gaps adjuster will exploit"} items={isIn ? result.weaknesses : result.gaps} accent="#dc2626" />
      </div>
      <Section label={isIn ? "Red flags" : "Adjuster will attack"} items={isIn ? result.red_flags : result.adjuster_will_attack} accent="#d97706" />
      <Section label="Missing documentation" items={result.missing_docs} accent="#9ca3af" />
      {(isIn ? result.settlement_posture : result.before_you_send) && (
        <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#374151", marginBottom: "0.75rem" }}>
          <strong>{isIn ? "Settlement posture:" : "Before you send:"}</strong>{" "}{isIn ? result.settlement_posture : result.before_you_send}
        </div>
      )}
      {(isIn ? result.adjuster_notes : result.attorney_notes) && (
        <div style={{ fontSize: 13, color: "#6b7280", borderTop: "1px solid #f3f4f6", paddingTop: "0.75rem" }}>
          <strong style={{ color: "#374151" }}>{isIn ? "Adjuster notes:" : "Attorney notes:"}</strong>{" "}{isIn ? result.adjuster_notes : result.attorney_notes}
        </div>
      )}
    </div>
  );
}
