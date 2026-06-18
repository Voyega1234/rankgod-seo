"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const SCAN_STEPS = [
  { pct: 5,  msg: "กำลังตรวจสอบ Sitemap.xml และ Robots.txt…" },
  { pct: 12, msg: "กำลัง Crawl หน้าแรกและ Navigation…" },
  { pct: 25, msg: "กำลัง Scan หน้าสินค้าและ Category…" },
  { pct: 40, msg: "กำลังวิเคราะห์ Title, H1, Meta Description…" },
  { pct: 52, msg: "กำลังตรวจสอบ Schema Markup และ Internal Links…" },
  { pct: 62, msg: "RankGod กำลังวิเคราะห์ข้อมูลเชิงลึก…" },
  { pct: 72, msg: "RankGod กำลังวิเคราะห์ Keyword Suggestions…" },
  { pct: 80, msg: "RankGod กำลังระบุ Competitor ที่ควรโฟกัส…" },
  { pct: 87, msg: "RankGod กำลังวางโครงสร้าง Sitemap ละเอียด…" },
  { pct: 93, msg: "RankGod กำลังสร้างแผน SEO 4 Phase ภาษาไทย…" },
  { pct: 97, msg: "กำลังสรุปผลและสร้างรายงาน…" },
];

type Tier = "standard" | "premium";

type LoadState =
  | { status: "idle" }
  | { status: "site"; step: number; progress: number; tier: Tier }
  | { status: "page" };

const TIER_CONFIG: Record<Tier, { label: string; model: string; badge: string; desc: string; color: string }> = {
  standard: {
    label: "RankGod Standard",
    model: "gemini-2.5-flash",
    badge: "Standard",
    desc: "เร็ว · เหมาะสำหรับสแกนทั่วไป",
    color: "rgba(255,255,255,0.55)",
  },
  premium: {
    label: "RankGod Premium",
    model: "gemini-3.5-flash",
    badge: "Premium",
    desc: "ละเอียดสูงสุด · Insight เชิงลึกสำหรับทีม Sales",
    color: "#a78bfa",
  },
};

export default function HomePage() {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [isSite, setIsSite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("premium");
  const router = useRouter();
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const detectIsSite = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.includes("\n") || trimmed.length > 200) return false;
    if (!trimmed.includes(" ")) return true;
    return false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setError(null);
    setIsSite(detectIsSite(e.target.value));
  };

  const stopProgress = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
  };

  const startProgress = (t: Tier) => {
    let currentStep = 0;
    setLoadState({ status: "site", step: 0, progress: SCAN_STEPS[0].pct, tier: t });

    const STEP_DELAYS = [6000, 12000, 20000, 18000, 16000, 5000, 18000, 18000, 20000, 15000];
    const tick = () => {
      currentStep++;
      if (currentStep < SCAN_STEPS.length) {
        setLoadState({ status: "site", step: currentStep, progress: SCAN_STEPS[currentStep].pct, tier: t });
        const delay = STEP_DELAYS[currentStep - 1] ?? 10000;
        stepTimerRef.current = setTimeout(tick, delay);
      }
    };
    stepTimerRef.current = setTimeout(tick, STEP_DELAYS[0]);
  };

  const handleSubmit = async () => {
    if (!input.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    setError(null);
    const siteScan = detectIsSite(input);
    setIsSite(siteScan);

    if (siteScan) {
      setLoadState({ status: "site", step: 0, progress: SCAN_STEPS[0].pct, tier });
      startProgress(tier);

      try {
        const res = await fetch("/api/site-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: input.trim(), model: TIER_CONFIG[tier].model }),
        });
        stopProgress();
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setLoadState({ status: "site", step: SCAN_STEPS.length - 1, progress: 100, tier });
        await new Promise(r => setTimeout(r, 400));
        sessionStorage.setItem("rankgod_audit", JSON.stringify(data));
        localStorage.setItem("rankgod_audit", JSON.stringify(data));
        router.push("/results?mode=audit");
      } catch (err) {
        stopProgress();
        setLoadState({ status: "idle" });
        const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
        setError(msg.includes("fetch") || msg.includes("network")
          ? "ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบ internet และลองใหม่"
          : msg.length > 100 ? "เกิดข้อผิดพลาดในการ scan กรุณาลองใหม่" : msg);
      }
    } else {
      setLoadState({ status: "page" });
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: input.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "เกิดข้อผิดพลาด" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        sessionStorage.setItem("rankgod_result", JSON.stringify(data));
        localStorage.setItem("rankgod_result", JSON.stringify(data));
        router.push("/results");
      } catch (err) {
        setLoadState({ status: "idle" });
        const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
        setError(msg.length > 100 ? "เกิดข้อผิดพลาด กรุณาลองใหม่" : msg);
      }
    }
  };

  useEffect(() => () => stopProgress(), []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Loading screen: site scan ──────────────────────────────────────────────
  if (loadState.status === "site") {
    const { step, progress, tier: activeTier } = loadState;
    const currentMsg = SCAN_STEPS[step]?.msg ?? "กำลังประมวลผล…";
    const cfg = TIER_CONFIG[activeTier];
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0f",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 24px",
      }}>
        <style>{`@keyframes shimmer{0%{left:-40%}100%{left:140%}}`}</style>
        <div style={{ width: "100%", maxWidth: "500px", textAlign: "center" }}>

          {/* Tier badge */}
          <div style={{ marginBottom: "20px" }}>
            <span style={{
              display: "inline-block",
              padding: "3px 12px",
              borderRadius: "20px",
              border: `1px solid ${cfg.color}40`,
              color: cfg.color,
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}>
              {cfg.label}
            </span>
          </div>

          {/* Domain */}
          <p style={{
            color: "rgba(255,255,255,0.22)", fontSize: "11px",
            letterSpacing: "0.18em", textTransform: "uppercase",
            marginBottom: "44px", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {input.trim()}
          </p>

          {/* Progress bar */}
          <div style={{ marginBottom: "36px" }}>
            <div style={{
              height: "5px", background: "rgba(255,255,255,0.08)",
              borderRadius: "3px", overflow: "hidden", position: "relative",
            }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress}%`,
                background: activeTier === "premium"
                  ? "linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)"
                  : "linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.85) 100%)",
                borderRadius: "3px",
                transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
              }} />
              <div style={{
                position: "absolute", top: 0, bottom: 0, width: "40%",
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                animation: "shimmer 2.2s ease-in-out infinite",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px" }}>กำลังสแกน</span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px", fontWeight: 600 }}>{progress}%</span>
            </div>
          </div>

          {/* Step message */}
          <p style={{
            color: "rgba(255,255,255,0.82)", fontSize: "15px",
            lineHeight: "1.65", minHeight: "52px",
            marginBottom: "40px", transition: "opacity 0.4s ease",
          }}>
            {currentMsg}
          </p>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: "5px", marginBottom: "36px" }}>
            {SCAN_STEPS.map((_, i) => (
              <div key={i} style={{
                height: "4px",
                width: i < step ? "12px" : i === step ? "22px" : "4px",
                borderRadius: "2px",
                background: i < step
                  ? "rgba(255,255,255,0.28)"
                  : i === step
                  ? (activeTier === "premium" ? "#a78bfa" : "rgba(255,255,255,0.82)")
                  : "rgba(255,255,255,0.1)",
                transition: "all 0.5s ease",
              }} />
            ))}
          </div>

          <p style={{ color: "rgba(255,255,255,0.12)", fontSize: "12px" }}>
            อาจใช้เวลา 1–3 นาที ขึ้นอยู่กับขนาดเว็บ
          </p>
        </div>
      </div>
    );
  }

  // ── Loading screen: single page ────────────────────────────────────────────
  if (loadState.status === "page") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto" />
          <p className="text-white/25 text-sm tracking-widest uppercase">Analyzing</p>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">

        <div className={`w-full space-y-3 ${shake ? "animate-shake" : ""}`}>
          <div className="relative">
            <textarea
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="วาง domain หรือ URL เช่น yoursite.com"
              rows={1}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-2xl px-6 py-4 pr-14 text-white placeholder-white/20 text-base resize-none overflow-hidden focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all duration-200 leading-relaxed"
              style={{ minHeight: "56px", maxHeight: "300px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 300) + "px";
              }}
            />
            <button
              onClick={handleSubmit}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Tier selector — แสดงเฉพาะเมื่อเป็น site scan */}
          {isSite && (
            <div style={{ display: "flex", gap: "8px" }}>
              {(["standard", "premium"] as Tier[]).map((t) => {
                const cfg = TIER_CONFIG[t];
                const active = tier === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "14px",
                      border: active
                        ? `1px solid ${cfg.color}60`
                        : "1px solid rgba(255,255,255,0.07)",
                      background: active
                        ? (t === "premium" ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.06)")
                        : "rgba(255,255,255,0.03)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <span style={{
                        fontSize: "12px", fontWeight: 600,
                        color: active ? cfg.color : "rgba(255,255,255,0.35)",
                        letterSpacing: "0.02em",
                      }}>
                        {cfg.label}
                      </span>
                      {t === "premium" && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700,
                          color: "#a78bfa", letterSpacing: "0.08em",
                          background: "rgba(167,139,250,0.15)",
                          padding: "1px 6px", borderRadius: "4px",
                        }}>
                          แนะนำ
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: "11px",
                      color: active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)",
                      margin: 0,
                    }}>
                      {cfg.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {input.trim() && !isSite && (
            <p className="text-white/20 text-xs px-2 transition-all">
              → วิเคราะห์บทความเดียว
            </p>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-400/80 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400/40 text-xs mt-1 hover:text-red-400/70"
              >
                ปิด ×
              </button>
            </div>
          )}
        </div>

        <span className="text-white/15 text-sm tracking-[0.3em] uppercase select-none">
          RankGod
        </span>
      </div>
    </div>
  );
}
