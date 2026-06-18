"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisResult } from "@/lib/types";

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 88 ? "#22c55e" : pct >= 70 ? "#eab308" : pct >= 50 ? "#f97316" : "#ef4444";
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="40" stroke="white" strokeOpacity="0.08" strokeWidth="6" fill="none" />
        <circle cx="48" cy="48" r="40" stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={`${2 * Math.PI * 40}`}
          strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{Math.round(score)}</span>
        <span className="text-xs text-white/40">/{max}</span>
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors: Record<string, string> = {
    "Keep": "bg-green-500/20 text-green-400 border-green-500/30",
    "Minor Optimize": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Optimize": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "Major Rewrite": "bg-orange-500/20 text-orange-400 border-orange-500/30",
    "Expand": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "Merge": "bg-pink-500/20 text-pink-400 border-pink-500/30",
    "Noindex Candidate": "bg-red-500/20 text-red-400 border-red-500/30",
    "Rebuild From Scratch": "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors[decision] || "bg-white/10 text-white/60 border-white/20"}`}>
      {decision}
    </span>
  );
}

function CopyBtn({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button onClick={copy} className="shrink-0 text-xs px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white/40 hover:text-white/70 transition-colors">
      {done ? "✓" : label}
    </button>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-white/[0.06] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white/50 text-xs tracking-widest uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function CategoryBar({ name, score, maxScore, status, exactFixes }: {
  name: string; score: number; maxScore: number; status: string; exactFixes: string[];
}) {
  const [open, setOpen] = useState(false);
  const pct = (score / maxScore) * 100;
  const color = status === "excellent" ? "#22c55e" : status === "good" ? "#3b82f6" : status === "warning" ? "#eab308" : "#ef4444";
  return (
    <div className="space-y-1">
      <button className="w-full text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white/70">{name}</span>
          <span className="text-white/40">{score}/{maxScore} {status !== "excellent" && status !== "good" ? "↑ tap to fix" : ""}</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </button>
      {open && exactFixes.length > 0 && (
        <div className="mt-2 pl-3 border-l-2 border-white/10 space-y-1">
          {exactFixes.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-white/30 text-xs mt-0.5">→</span>
              <span className="text-white/60 text-xs">{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [auditResult, setAuditResult] = useState<import("@/lib/siteAudit").SiteAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "audit") {
      const stored = sessionStorage.getItem("rankgod_audit") || localStorage.getItem("rankgod_audit");
      if (!stored) { router.push("/"); return; }
      try { setAuditResult(JSON.parse(stored)); }
      catch { router.push("/"); }
    } else {
      const stored = sessionStorage.getItem("rankgod_result") || localStorage.getItem("rankgod_result");
      if (!stored) { router.push("/"); return; }
      try { setResult(JSON.parse(stored)); }
      catch { router.push("/"); }
    }
  }, [router]);

  const exportHtml = async () => {
    if (!auditResult || exporting) return;
    setExporting(true);
    setExportError(null);
    setExportDone(false);
    try {
      const res = await fetch("/api/export-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auditResult),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      if (blob.size < 100) throw new Error("ไฟล์ว่างเปล่า กรุณาลองใหม่");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const hostname = new URL(auditResult.domain).hostname;
      a.download = `seo-audit-${hostname}-${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export ล้มเหลว กรุณาลองใหม่");
    } finally {
      setExporting(false);
    }
  };

  const downloadFile = (content: string, filename: string, type = "text/markdown") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Audit mode (Sales Report UI) ─────────────────────────────────────────
  if (auditResult) {
    const sc = auditResult.scores;
    const overallGrade = sc.overall >= 8 ? "A" : sc.overall >= 6 ? "B" : sc.overall >= 4 ? "C" : "D";
    const gradeColor = { A: "#16a34a", B: "#65a30d", C: "#d97706", D: "#dc2626" }[overallGrade]!;
    const domain = auditResult.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const ai = auditResult.aiAnalysis;
    const allIssues = [
      ...auditResult.issues.critical,
      ...auditResult.issues.high,
      ...auditResult.issues.medium,
    ];
    // Build AI-generated impact/fix lookup keyed by issue id
    const aiInsightMap: Record<string, { impact: string[]; fix: string[] }> = {};
    (ai?.issueInsights || []).forEach(ins => { aiInsightMap[ins.id] = ins; });

    const prioStyle = (p: string) => ({
      critical: { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", label: "🚨 วิกฤต" },
      high:     { bg: "#fff7ed", border: "#fdba74", text: "#ea580c", label: "⚠️ สำคัญสูง" },
      medium:   { bg: "#fffbeb", border: "#fde68a", text: "#d97706", label: "💡 ปานกลาง" },
      low:      { bg: "#f8fafc", border: "#e2e8f0", text: "#94a3b8", label: "ต่ำ" },
    }[p] || { bg: "#f8fafc", border: "#e2e8f0", text: "#94a3b8", label: p });

    const scoreCol = (v: number) => v >= 8 ? "#16a34a" : v >= 5 ? "#d97706" : "#dc2626";

    const G = "#1a73e8"; // Google Blue
    const G_LIGHT = "#e8f0fe";
    const G_MID = "#4285f4";

    return (
      <div style={{ fontFamily: "'Google Sans', 'Noto Sans Thai', Arial, sans-serif", background: "#fff", minHeight: "100vh", color: "#202124" }}>
        {/* ── Top bar — Google Think style ── */}
        <div style={{ background: "#fff", borderBottom: "1px solid #dadce0", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 40, height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 400, color: "#202124", letterSpacing: "-0.3px" }}>
              <span style={{ color: G, fontWeight: 700 }}>Rank</span><span style={{ color: "#202124" }}>God</span>
            </span>
            <span style={{ color: "#dadce0", fontSize: 20 }}>|</span>
            <span style={{ fontSize: 14, color: "#5f6368", fontWeight: 400 }}>{domain}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={exportHtml} disabled={exporting}
              style={{ background: exportDone ? "#e6f4ea" : G, color: exportDone ? "#137333" : "#fff", border: "none", borderRadius: 4, padding: "8px 20px", fontWeight: 500, fontSize: 14, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.8 : 1, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.01em" }}>
              {exporting ? <><span style={{ width: 13, height: 13, border: "2px solid #ffffff50", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />กำลัง export…</> : exportDone ? "✓ ดาวน์โหลดแล้ว" : "↓ Export รายงาน"}
            </button>
            <button onClick={() => router.push("/")}
              style={{ background: "transparent", color: "#5f6368", border: "1px solid #dadce0", borderRadius: 4, padding: "8px 16px", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>
              สแกนใหม่
            </button>
          </div>
          {exportError && <div style={{ width: "100%", color: "#d93025", fontSize: 12, paddingBottom: 8 }}>{exportError}</div>}
        </div>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* ── Hero banner — full-width Google Think style ── */}
        <div style={{ background: G_LIGHT, borderBottom: "1px solid #dadce0", padding: "56px 40px 48px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", color: G, textTransform: "uppercase", marginBottom: 14 }}>Full-Site SEO Audit Report</div>
            <div style={{ fontSize: 44, fontWeight: 400, color: "#202124", marginBottom: 12, letterSpacing: "-1px", lineHeight: 1.15 }}>
              {domain.replace(/^www\./, "")}
            </div>
            <div style={{ fontSize: 16, color: "#5f6368", fontWeight: 400, marginBottom: 32 }}>
              Scan ครบ {auditResult.pageCount} หน้า · Discovered {auditResult.discoveredUrlCount} URL{auditResult.sitemap?.found ? " · พบ Sitemap.xml" : ""}{auditResult.isHttps ? " · HTTPS ✓" : ""}
            </div>
            <div style={{ fontSize: 13, color: "#80868b" }}>
              วิเคราะห์เมื่อ {new Date(auditResult.crawledAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })} · โดย RankGod
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 40px", display: "flex", flexDirection: "column", gap: 0 }}>

          {/* ── Score gauges ── */}
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>ผลคะแนน SEO</div>
            <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>วิเคราะห์จาก 6 มิติหลัก — 10 คะแนนเต็ม</div>
            <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderTop: "1px solid #dadce0", borderLeft: "1px solid #dadce0" }}>
              {[
                { l: "Overall", v: sc.overall, big: true },
                { l: "Technical", v: sc.technical },
                { l: "On-Page", v: sc.onpage },
                { l: "Structure", v: sc.siteStructure },
                { l: "UX/UI", v: sc.uxUi },
                { l: "Content", v: sc.contentQuality },
              ].map((s) => {
                const sz = s.big ? 120 : 96;
                const r = s.big ? 46 : 36;
                const sw = s.big ? 8 : 6;
                const circ = 2 * Math.PI * r;
                const col = s.v >= 8 ? "#0d904f" : s.v >= 5 ? "#f29900" : "#d93025";
                const trackCol = "#e8eaed";
                return (
                  <div key={s.l} style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px 24px", borderRight: "1px solid #dadce0", borderBottom: "1px solid #dadce0" }}>
                    <div style={{ position: "relative", width: sz, height: sz, marginBottom: 12 }}>
                      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ transform: "rotate(-90deg)" }}>
                        <circle cx={sz/2} cy={sz/2} r={r} stroke={trackCol} strokeWidth={sw} fill="none" />
                        <circle cx={sz/2} cy={sz/2} r={r} stroke={col} strokeWidth={sw} fill="none"
                          strokeDasharray={`${circ * (s.v / 10)} ${circ}`}
                          strokeLinecap="round" />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: s.big ? 30 : 22, fontWeight: 400, color: col, lineHeight: 1 }}>{s.v}</span>
                        <span style={{ fontSize: 11, color: "#9aa0a6", marginTop: 2 }}>/10</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: s.big ? 500 : 400, color: "#3c4043", textAlign: "center" }}>{s.l}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Issue summary strip ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "#dadce0", border: "1px solid #dadce0", marginBottom: 56 }}>
            {[
              { n: auditResult.issues.critical.length, label: "วิกฤต", sub: "ส่งผลต่อ ranking ทันที", col: "#d93025", bg: "#fff" },
              { n: auditResult.issues.high.length,     label: "สำคัญสูง", sub: "แก้ภายใน 1 เดือน", col: "#e37400", bg: "#fff" },
              { n: auditResult.issues.medium.length,   label: "ปานกลาง", sub: "แก้ใน 2–3 เดือน", col: "#f29900", bg: "#fff" },
              { n: auditResult.strengths.length,       label: "จุดแข็ง", sub: "ดีอยู่แล้ว", col: "#0d904f", bg: "#fff" },
            ].map(b => (
              <div key={b.label} style={{ background: b.bg, padding: "24px 28px" }}>
                <div style={{ fontSize: 44, fontWeight: 400, color: b.col, lineHeight: 1, marginBottom: 8 }}>{b.n}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#202124", marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: 12, color: "#5f6368" }}>{b.sub}</div>
              </div>
            ))}
          </div>

          {/* ── AI Sales Pitch ── */}
          {ai?.salesPitchSummary && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", color: G, textTransform: "uppercase", marginBottom: 16 }}>Sales Pitch</div>
              <div style={{ fontSize: 22, fontWeight: 400, color: "#202124", lineHeight: 1.6, marginBottom: 20, maxWidth: 720 }}>{ai.salesPitchSummary}</div>
              {ai.overallVerdict && (
                <div style={{ fontSize: 15, color: "#5f6368", lineHeight: 1.75, maxWidth: 720, marginBottom: 20 }}>{ai.overallVerdict}</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  `ธุรกิจ: ${ai.businessType}`,
                  `กลุ่มเป้า: ${ai.targetAudience}`,
                  `ระดับ SEO: ${ai.currentSeoMaturity}`,
                ].filter(t => !t.includes("undefined")).map(t => (
                  <span key={t} style={{ background: G_LIGHT, color: G, border: `1px solid ${G}30`, borderRadius: 4, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Website Insight Summary ── */}
          {ai?.websiteInsightSummary && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", color: G, textTransform: "uppercase", marginBottom: 16 }}>Website Insight</div>
              <div style={{ fontSize: 20, fontWeight: 400, color: "#202124", lineHeight: 1.7, maxWidth: 760, background: G_LIGHT, border: `1px solid ${G}20`, borderRadius: 8, padding: "24px 28px" }}>
                {ai.websiteInsightSummary}
              </div>
            </div>
          )}

          {/* ── Sales Insight ── */}
          {(ai?.salesInsight || (ai?.salesTalkingPoints && ai.salesTalkingPoints.length > 0)) && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Sales Insight</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>มุมขายงานจากปัญหาจริงของเว็บ — เอาไปคุยกับลูกค้าได้เลย</div>
              {ai.salesInsight && (
                <div style={{ fontSize: 17, color: "#202124", lineHeight: 1.75, maxWidth: 760, marginBottom: 28, padding: "20px 24px", background: "#fff8e1", borderLeft: "4px solid #f29900", borderRadius: "0 8px 8px 0" }}>
                  {ai.salesInsight}
                </div>
              )}
              {ai.salesTalkingPoints && ai.salesTalkingPoints.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ai.salesTalkingPoints.map((pt, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 18px", background: "#fff", border: "1px solid #dadce0", borderRadius: 8 }}>
                      <span style={{ color: G, fontWeight: 700, fontSize: 14, minWidth: 22, marginTop: 1 }}>{i + 1}</span>
                      <span style={{ fontSize: 14, color: "#3c4043", lineHeight: 1.6 }}>{pt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SEO Opportunity ── */}
          {ai?.seoOpportunity && ai.seoOpportunity.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>SEO Opportunity</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>โอกาสด้าน SEO ที่เว็บยังไม่ได้ใช้ประโยชน์</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ai.seoOpportunity.map((op, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 20px", background: "#fff", border: "1px solid #dadce0", borderRadius: 8 }}>
                    <span style={{ background: G_LIGHT, color: G, borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, minWidth: 26 }}>{i + 1}</span>
                    <span style={{ fontSize: 14, color: "#3c4043", lineHeight: 1.65 }}>{op}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Content Opportunity ── */}
          {ai?.contentOpportunity && ai.contentOpportunity.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Content Opportunity</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>เนื้อหาที่ควรเพิ่มหรือปรับเพื่อ rank และปิดการขายดีขึ้น</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 1, border: "1px solid #dadce0", background: "#dadce0", borderRadius: 8, overflow: "hidden" }}>
                {ai.contentOpportunity.map((c, i) => (
                  <div key={i} style={{ background: "#fff", padding: "22px 24px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: G, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{c.pageType}</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#202124", marginBottom: 8 }}>{c.gap}</div>
                    <div style={{ fontSize: 13, color: "#5f6368", lineHeight: 1.6, marginBottom: 10 }}>{c.why}</div>
                    <div style={{ fontSize: 13, color: "#0d904f", lineHeight: 1.6, paddingTop: 10, borderTop: "1px solid #f1f3f4" }}>→ {c.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── UX/UI Insight ── */}
          {ai?.uxInsights && ai.uxInsights.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>UX/UI Insight</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>จุดที่ทำให้ผู้ใช้ลังเล ไม่กด CTA หรือออกจากหน้า</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ai.uxInsights.map((u, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #dadce0", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, background: "#dadce0" }}>
                      <div style={{ background: "#fff", padding: "16px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#d93025", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>ปัญหา</div>
                        <div style={{ fontSize: 13, color: "#202124", lineHeight: 1.55 }}>{u.issue}</div>
                        {u.location && <div style={{ fontSize: 11, color: "#80868b", marginTop: 6 }}>{u.location}</div>}
                      </div>
                      <div style={{ background: "#fff8f8", padding: "16px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#e37400", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>กระทบอะไร</div>
                        <div style={{ fontSize: 13, color: "#3c4043", lineHeight: 1.55 }}>{u.impact}</div>
                      </div>
                      <div style={{ background: "#f6fef9", padding: "16px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#0d904f", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>วิธีแก้</div>
                        <div style={{ fontSize: 13, color: "#3c4043", lineHeight: 1.55 }}>{u.fix}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Business Insight ── */}
          {ai?.businessInsights && ai.businessInsights.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Business Insight</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>โอกาสทางธุรกิจสำหรับ Owner, CMO และ CEO</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
                {ai.businessInsights.map((b, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #dadce0", borderRadius: 8, padding: "24px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#202124", marginBottom: 12 }}>{b.opportunity}</div>
                    <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 8, lineHeight: 1.6 }}><span style={{ color: "#80868b", fontWeight: 500 }}>ปัจจุบัน: </span>{b.currentState}</div>
                    <div style={{ fontSize: 13, color: "#0d904f", marginBottom: 8, lineHeight: 1.6 }}><span style={{ fontWeight: 500 }}>ถ้าแก้ได้: </span>{b.potentialImpact}</div>
                    <div style={{ fontSize: 12, color: "#80868b", borderTop: "1px solid #f1f3f4", paddingTop: 10, marginTop: 10, lineHeight: 1.5 }}>💡 {b.investment}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Quick Wins ── */}
          {ai?.quickWins && ai.quickWins.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Quick Wins</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>งานที่ทำได้เลย effort น้อย impact สูง</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ai.quickWins.map((qw, i) => {
                  const impactColor = { สูงมาก: "#d93025", สูง: "#e37400", กลาง: "#f29900" }[qw.impact] || "#f29900";
                  const effortColor = { ต่ำ: "#0d904f", กลาง: "#e37400", สูง: "#d93025" }[qw.effort] || "#5f6368";
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center", padding: "14px 20px", background: "#fff", border: "1px solid #dadce0", borderRadius: 8 }}>
                      <div style={{ fontSize: 14, color: "#202124", lineHeight: 1.5 }}>{qw.task}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: G, background: G_LIGHT, borderRadius: 4, padding: "3px 10px", whiteSpace: "nowrap" }}>{qw.role}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: impactColor, background: `${impactColor}12`, borderRadius: 4, padding: "3px 10px", whiteSpace: "nowrap" }}>Impact: {qw.impact}</span>
                      <span style={{ fontSize: 11, color: effortColor, whiteSpace: "nowrap" }}>{qw.timeframe}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Role-based Insight ── */}
          {ai?.roleInsights && ai.roleInsights.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Insight แยกตามทีม</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 28 }}>แต่ละทีมรู้ว่าต้องทำอะไร และทำไม</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
                {ai.roleInsights.map((r, i) => {
                  const pColor = { ด่วน: "#d93025", สำคัญ: "#e37400", ทำเพิ่ม: "#0d904f" }[r.priority] || "#5f6368";
                  return (
                    <div key={i} style={{ background: "#fff", border: "1px solid #dadce0", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f1f3f4" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#202124" }}>{r.role}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pColor, background: `${pColor}12`, borderRadius: 4, padding: "3px 10px" }}>{r.priority}</span>
                      </div>
                      <div style={{ padding: "16px 20px" }}>
                        <div style={{ fontSize: 13, color: "#3c4043", lineHeight: 1.65, marginBottom: 14 }}>{r.insight}</div>
                        {r.actions && r.actions.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {r.actions.map((act, j) => (
                              <div key={j} style={{ fontSize: 12, color: "#5f6368", display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ color: G, fontWeight: 700, minWidth: 14 }}>→</span>
                                <span style={{ lineHeight: 1.5 }}>{act}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Keyword Suggestions ── */}
          {ai?.keywordSuggestions && ai.keywordSuggestions.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Keyword Suggestions</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>Keyword groups ที่ควร target — วิเคราะห์จากธุรกิจจริงในเว็บ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 1, border: "1px solid #dadce0", background: "#dadce0" }}>
                {ai.keywordSuggestions.map((ks, i) => {
                  const pc = { สูงมาก: "#d93025", สูง: "#e37400", กลาง: "#f29900" }[ks.priority] || "#f29900";
                  return (
                    <div key={i} style={{ background: "#fff", padding: "24px 28px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 500, color: "#202124", lineHeight: 1.35 }}>{ks.group}</div>
                        <span style={{ color: pc, background: `${pc}12`, border: `1px solid ${pc}30`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{ks.priority}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {(ks.keywords || []).slice(0, 4).map((k, j) => (
                          <span key={j} style={{ background: G_LIGHT, border: `1px solid ${G}30`, borderRadius: 4, padding: "3px 10px", fontSize: 12, color: G }}>{k}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 13, color: "#5f6368", lineHeight: 1.65 }}>{ks.reason}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Competitors ── */}
          {ai?.competitors && ai.competitors.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Competitor Analysis</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>คู่แข่งหลักในอุตสาหกรรม — จุดแข็งและช่องว่างที่เราเอาชนะได้</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 1, border: "1px solid #dadce0", background: "#dadce0" }}>
                {ai.competitors.map((c, i) => (
                  <div key={i} style={{ background: "#fff", padding: "0" }}>
                    <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f3f4" }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#202124" }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: G, marginTop: 2 }}>{c.domain}</div>
                    </div>
                    <div style={{ padding: "16px 24px 20px" }}>
                      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 14, lineHeight: 1.65 }}>{c.whyFocus}</div>
                      {c.gaps?.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#0d904f", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>โอกาสของเรา</div>
                          {c.gaps.map((g, j) => <div key={j} style={{ fontSize: 13, color: "#137333", padding: "3px 0", lineHeight: 1.6 }}>→ {g}</div>)}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Detailed Sitemap ── */}
          {ai?.detailedSitemap && ai.detailedSitemap.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>โครงสร้าง Sitemap แนะนำ</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>ทุกหน้าที่ควรมี — แบ่งตาม section พร้อม target keywords</div>
              <div style={{ background: G_LIGHT, border: `1px solid ${G}30`, borderLeft: `4px solid ${G}`, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 16 }}>🏠</span>
                <span style={{ fontWeight: 500, color: G, fontSize: 14 }}>{domain} — Homepage</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ai.detailedSitemap.map((sec, si) => (
                  <div key={si} style={{ border: "1px solid #dadce0" }}>
                    <div style={{ background: "#f8f9fa", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #dadce0" }}>
                      <span>{sec.icon}</span>
                      <span style={{ fontWeight: 500, fontSize: 14, color: "#202124", flex: 1 }}>{sec.section}</span>
                      <span style={{ fontSize: 12, color: "#80868b" }}>{sec.pages?.length || 0} หน้า</span>
                    </div>
                    <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 1, background: "#dadce0" }}>
                      {(sec.pages || []).map((pg, pi) => {
                        const isNew = (pg.note || "").includes("สร้างใหม่") || (pg.note || "").includes("ต้องสร้าง");
                        const pgCol = { high: "#d93025", medium: "#f29900", low: "#80868b" }[pg.priority] || "#80868b";
                        return (
                          <div key={pi} style={{ background: "#fff", borderLeft: `3px solid ${pgCol}`, padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <code style={{ fontSize: 11, color: "#5f6368", background: "#f1f3f4", padding: "1px 6px" }}>{pg.slug}</code>
                              <span style={{ fontSize: 10, background: "#f1f3f4", color: "#5f6368", padding: "1px 6px", textTransform: "uppercase", fontWeight: 600 }}>{pg.pageType}</span>
                              {isNew && <span style={{ fontSize: 10, background: "#fce8e6", color: "#d93025", border: "1px solid #f5c6c2", padding: "1px 6px", fontWeight: 600 }}>✦ สร้างใหม่</span>}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#202124", marginBottom: 6 }}>{pg.title}</div>
                            {pg.targetKeywords?.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {pg.targetKeywords.map((k, ki) => (
                                  <span key={ki} style={{ fontSize: 11, background: G_LIGHT, color: G, border: `1px solid ${G}30`, padding: "1px 7px" }}>{k}</span>
                                ))}
                              </div>
                            )}
                            {pg.note && <div style={{ fontSize: 11, color: "#80868b", marginTop: 6, fontStyle: "italic" }}>{pg.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Issues ── */}
          {allIssues.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>
                ปัญหาที่พบ <span style={{ color: "#80868b", fontWeight: 300 }}>({allIssues.length} รายการ)</span>
              </div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>เรียงตามความเร่งด่วน — วิกฤตต้องแก้ก่อน</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {allIssues.map((item) => {
                  const insight = aiInsightMap[item.id];
                  const impact = insight?.impact?.length ? insight.impact : item.impact;
                  const fix = insight?.fix?.length ? insight.fix : item.fix;
                  const dotColor = item.priority === "critical" ? "#d93025" : item.priority === "high" ? "#e37400" : "#f29900";
                  const labelMap: Record<string, string> = { critical: "วิกฤต", high: "สำคัญสูง", medium: "ปานกลาง" };
                  return (
                    <div key={item.id} style={{ borderBottom: "1px solid #dadce0", padding: "28px 0" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 16, fontWeight: 500, color: "#202124" }}>{item.title}</span>
                            <span style={{ fontSize: 11, color: dotColor, background: `${dotColor}12`, border: `1px solid ${dotColor}30`, borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>{labelMap[item.priority] || item.priority}</span>
                            <span style={{ fontSize: 12, color: "#80868b", marginLeft: "auto" }}>{item.category} · {item.effortDays} วัน</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>ผลกระทบ</div>
                              {impact.map((t, j) => (
                                <div key={j} style={{ fontSize: 14, color: "#3c4043", padding: "4px 0", lineHeight: 1.65, borderBottom: "1px solid #f1f3f4" }}>— {t}</div>
                              ))}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#137333", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>วิธีแก้ไข</div>
                              {fix.map((t, j) => (
                                <div key={j} style={{ fontSize: 14, color: "#137333", padding: "4px 0", lineHeight: 1.65, borderBottom: "1px solid #f1f3f4" }}>→ {t}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Action Plan ── */}
          {ai?.actionPlan && ai.actionPlan.length > 0 && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>Action Plan</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>ลำดับงานที่แนะนำพร้อม timeline และผลที่คาดหวัง</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 1, border: "1px solid #dadce0", background: "#dadce0" }}>
                {ai.actionPlan.map((ph, idx) => {
                  const pc = [G, "#0d904f", "#f29900", "#d93025"][idx % 4];
                  return (
                    <div key={ph.phase} style={{ background: "#fff", padding: "28px 24px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: pc, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Phase {ph.phase}</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#202124", marginBottom: 4 }}>{ph.name}</div>
                      <div style={{ fontSize: 12, color: "#80868b", marginBottom: 16 }}>{ph.duration}</div>
                      <div style={{ width: 40, height: 2, background: pc, marginBottom: 16 }} />
                      {ph.tasks.map((t, j) => <div key={j} style={{ fontSize: 13, color: "#3c4043", padding: "4px 0", lineHeight: 1.65 }}>· {t}</div>)}
                      {ph.expectedImpact && <div style={{ fontSize: 12, fontWeight: 500, color: pc, marginTop: 16, paddingTop: 14, borderTop: "1px solid #dadce0" }}>ผล: {ph.expectedImpact}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Expected Results ── */}
          {ai?.expectedResults && (
            <div style={{ marginBottom: 56, paddingBottom: 56, borderBottom: "1px solid #dadce0" }}>
              <div style={{ fontSize: 28, fontWeight: 400, color: "#202124", marginBottom: 6, letterSpacing: "-0.5px" }}>ผลลัพธ์ที่คาดหวัง</div>
              <div style={{ fontSize: 15, color: "#5f6368", marginBottom: 32 }}>เมื่อดำเนิน Action Plan ครบ 90 วัน</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, border: "1px solid #dadce0", background: "#dadce0" }}>
                {[
                  { label: "30 วันแรก", items: ai.expectedResults.day30, color: "#f29900" },
                  { label: "60 วัน", items: ai.expectedResults.day60, color: G },
                  { label: "90 วัน", items: ai.expectedResults.day90, color: "#0d904f" },
                ].map(col => (
                  <div key={col.label} style={{ background: "#fff", padding: "28px 24px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: col.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{col.label}</div>
                    <div style={{ width: 32, height: 3, background: col.color, marginBottom: 20 }} />
                    {col.items?.map((t, i) => <div key={i} style={{ fontSize: 14, color: "#3c4043", padding: "5px 0", borderBottom: "1px solid #f1f3f4", lineHeight: 1.6 }}>→ {t}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Export CTA ── */}
          <div style={{ background: G_LIGHT, border: `1px solid ${G}30`, padding: "36px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 48 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 400, color: "#202124", marginBottom: 8 }}>พร้อมส่งให้ลูกค้าแล้ว</div>
              <div style={{ fontSize: 14, color: "#5f6368" }}>Export เป็น HTML พร้อม Print เป็น PDF ได้ทันที</div>
            </div>
            <button onClick={exportHtml} disabled={exporting}
              style={{ background: exportDone ? "#e6f4ea" : G, color: exportDone ? "#137333" : "#fff", borderRadius: 4, padding: "12px 32px", fontWeight: 500, fontSize: 15, border: "none", cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.8 : 1 }}>
              {exporting ? "กำลัง export…" : exportDone ? "✓ ดาวน์โหลดแล้ว" : "↓ Export HTML Report"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Single page mode ───────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  const { apexScore, oneSentenceTruth, finalDecision, topFixes, topProblems, parsed,
    mainArticle, competitors, titleOptions, metaOptions, h2Suggestions,
    internalLinkOpportunities, aiSearchFindings, freshnessRisks, conversionIssues,
    actionPlan24h, actionPlan7d, markdownReport, rewritePrompt, rewriteBrief,
    faqSuggestions, isAiEnhanced, warnings, coJourneyScore, coJourneyChecklist,
    failureReasons, officialSourceSuggestions } = result;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "problems", label: "Why Losing" },
    { id: "fixes", label: "Fix First" },
    { id: "rewrite", label: "Rewrite" },
    { id: "competitors", label: "Competitors" },
    { id: "internal", label: "Internal Links" },
    { id: "ai", label: "AI Search" },
    { id: "trust", label: "Trust" },
    { id: "freshness", label: "Freshness" },
    { id: "conversion", label: "Conversion" },
    { id: "exports", label: "Exports" },
  ];

  // Build a paste-ready AI prompt from rewrite brief
  const aiRewritePrompt = `You are an expert SEO content writer.

KEYWORD: ${parsed.detectedKeyword || ""}
URL TO IMPROVE: ${parsed.mainArticleUrl || ""}

REWRITE BRIEF:
${rewriteBrief}

SUGGESTED STRUCTURE:
${h2Suggestions.map((h, i) => `${i + 1}. ${h}`).join("\n")}

FAQ TO INCLUDE:
${faqSuggestions.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

Write a complete, publish-ready article following this brief. White-hat SEO only. No fluff.`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push("/")} className="text-white/30 hover:text-white/60 text-sm transition-colors">
          ← RankGod
        </button>
        <div className="flex items-center gap-3">
          {isAiEnhanced && (
            <span className="text-xs text-purple-400/70 border border-purple-500/20 px-2 py-0.5 rounded-full">AI Enhanced</span>
          )}
          <button onClick={() => router.push("/history")} className="text-white/30 hover:text-white/60 text-xs transition-colors">History</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border border-white/[0.06] rounded-2xl p-6">
          <ScoreBadge score={apexScore.total} max={apexScore.maxTotal} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-white/40 text-xs tracking-widest uppercase">{apexScore.verdict}</span>
              <DecisionBadge decision={finalDecision} />
            </div>
            <p className="text-white/80 text-sm leading-relaxed">{oneSentenceTruth}</p>
            {parsed.detectedKeyword && (
              <p className="text-white/30 text-xs">Keyword: <span className="text-white/50">{parsed.detectedKeyword}</span></p>
            )}
            {parsed.mainArticleUrl && (
              <p className="text-white/30 text-xs truncate">{parsed.mainArticleUrl}</p>
            )}
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 space-y-1">
            {warnings.map((w, i) => <p key={i} className="text-yellow-400/70 text-xs">{w}</p>)}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${activeTab === tab.id ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <Section title="Apex Score — tap any bar to see fixes">
              <div className="space-y-3">
                {apexScore.categories.map(cat => (
                  <CategoryBar key={cat.name} name={cat.name} score={cat.score}
                    maxScore={cat.maxScore} status={cat.status} exactFixes={cat.exactFixes} />
                ))}
              </div>
            </Section>

            {coJourneyScore !== null && coJourneyChecklist && (
              <Section title="Co Journey Readiness">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-white">{coJourneyScore}%</span>
                  <span className="text-white/40 text-sm">Visa/Travel Readiness</span>
                </div>
                <div className="space-y-2">
                  {coJourneyChecklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={item.pass ? "text-green-400" : "text-red-400"}>{item.pass ? "✓" : "✗"}</span>
                      <div>
                        <span className="text-white/70 text-sm">{item.label}</span>
                        {!item.pass && <p className="text-white/40 text-xs mt-0.5">{item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Do These Today" action={<CopyBtn text={actionPlan24h.join("\n")} label="copy all" />}>
              <ol className="space-y-2">
                {actionPlan24h.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-white/20 text-sm w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-start justify-between gap-3">
                      <span className="text-white/70 text-sm">{a}</span>
                      <CopyBtn text={a} />
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        )}

        {/* ── Why Losing ── */}
        {activeTab === "problems" && (
          <div className="space-y-4">
            <Section title={`Top Problems — ${parsed.detectedKeyword || "this article"}`}
              action={<CopyBtn text={topProblems.join("\n")} label="copy all" />}>
              <div className="space-y-3">
                {topProblems.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 border border-white/[0.06] rounded-xl p-4">
                    <span className="text-red-400/60 text-sm font-bold w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-start justify-between gap-3">
                      <p className="text-white/70 text-sm">{p}</p>
                      <CopyBtn text={p} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Detailed Failure Analysis">
              <div className="space-y-3">
                {failureReasons.slice(0, 8).map((r, i) => (
                  <div key={i} className="border border-white/[0.06] rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-white/80 text-sm font-medium">{r.type}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.impact === "high" ? "bg-red-500/20 text-red-400" : r.impact === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>
                          {r.impact} impact
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40`}>{r.effort}</span>
                      </div>
                    </div>
                    <p className="text-white/40 text-xs">{r.evidence.join(" • ")}</p>
                    <div className="flex items-start gap-2">
                      <span className="text-green-400/60 text-xs mt-0.5">→ Fix:</span>
                      <p className="text-white/60 text-sm flex-1">{r.fix}</p>
                      <CopyBtn text={r.fix} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── Fix First ── */}
        {activeTab === "fixes" && (
          <div className="space-y-4">
            <Section title="Top 5 Fixes — Highest Impact First"
              action={<CopyBtn text={topFixes.join("\n")} label="copy all" />}>
              <ol className="space-y-3">
                {topFixes.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 border border-white/[0.06] rounded-xl p-4">
                    <span className="text-white/20 w-5 text-sm font-bold shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-start justify-between gap-3">
                      <span className="text-white/70 text-sm">{f}</span>
                      <CopyBtn text={f} />
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="7-Day Plan" action={<CopyBtn text={actionPlan7d.join("\n")} label="copy all" />}>
              <ol className="space-y-2">
                {actionPlan7d.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-white/20 text-sm w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-start justify-between gap-3">
                      <span className="text-white/70 text-sm">{a}</span>
                      <CopyBtn text={a} />
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        )}

        {/* ── Rewrite ── */}
        {activeTab === "rewrite" && (
          <div className="space-y-4">
            {/* AI Write Prompt — star of the show */}
            <Section title="Paste This Into RankGod → Get Full Article"
              action={<CopyBtn text={aiRewritePrompt} label="copy prompt" />}>
              <div className="bg-white/[0.03] rounded-xl p-4 font-mono text-xs text-white/50 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {aiRewritePrompt}
              </div>
            </Section>

            {/* Rewrite Brief — bullets */}
            <Section title="Writer Brief" action={<CopyBtn text={rewriteBrief} label="copy" />}>
              <div className="space-y-1">
                {rewriteBrief.split("\n").filter(Boolean).map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-white/70 text-sm">{line}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Titles */}
            <Section title="Title Options" action={<CopyBtn text={titleOptions.join("\n")} label="copy all" />}>
              <div className="space-y-2">
                {titleOptions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-4 py-2.5 gap-3">
                    <span className="text-white/70 text-sm flex-1">{t}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white/25 text-xs">{t.length}ch</span>
                      <CopyBtn text={t} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Meta */}
            <Section title="Meta Descriptions" action={<CopyBtn text={metaOptions.join("\n")} label="copy all" />}>
              <div className="space-y-2">
                {metaOptions.map((m, i) => (
                  <div key={i} className="bg-white/[0.03] rounded-lg px-4 py-3 space-y-2">
                    <p className="text-white/70 text-sm">{m}</p>
                    <div className="flex justify-between">
                      <span className={`text-xs ${m.length > 155 ? "text-red-400" : "text-white/25"}`}>{m.length}/155 chars</span>
                      <CopyBtn text={m} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* H2 Structure */}
            <Section title="H2 Structure" action={<CopyBtn text={h2Suggestions.join("\n")} label="copy all" />}>
              <div className="space-y-2">
                {h2Suggestions.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-4 py-2.5">
                    <span className="text-white/20 text-xs font-mono shrink-0">H2</span>
                    <span className="text-white/70 text-sm flex-1">{h}</span>
                    <CopyBtn text={h} />
                  </div>
                ))}
              </div>
            </Section>

            {/* FAQ */}
            <Section title="FAQ — Ready to Paste"
              action={<CopyBtn text={faqSuggestions.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")} label="copy all" />}>
              <div className="space-y-3">
                {faqSuggestions.map((f, i) => (
                  <div key={i} className="border border-white/[0.06] rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-white/80 text-sm font-medium">{f.q}</p>
                      <CopyBtn text={`Q: ${f.q}\nA: ${f.a}`} />
                    </div>
                    <p className="text-white/50 text-sm">{f.a}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── Competitors ── */}
        {activeTab === "competitors" && (
          <Section title="Competitor Analysis">
            {competitors.length === 0 ? (
              <p className="text-white/40 text-sm">No competitor URLs were analyzed. Add competitor URLs to your input to see gap analysis.</p>
            ) : (
              <div className="space-y-6">
                {competitors.map((comp, i) => (
                  <div key={i} className="border border-white/[0.06] rounded-xl p-4 space-y-3">
                    <p className="text-white/50 text-xs truncate">{comp.url}</p>
                    {comp.extracted && (
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {[
                          ["Words", comp.extracted.wordCount],
                          ["H2s", comp.extracted.h2s?.length || 0],
                          ["FAQ", comp.extracted.hasFaq ? "✓" : "✗"],
                          ["Tables", (comp.extracted.tableCount ?? 0) > 0 ? "✓" : "✗"],
                        ].map(([label, val]) => (
                          <div key={label as string} className="bg-white/[0.03] rounded p-2 text-center">
                            <div className="text-white/30 text-xs">{label}</div>
                            <div className="text-white/70 font-medium">{val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {comp.whatTheyDoBetter.length > 0 && (
                      <div>
                        <p className="text-orange-400/60 text-xs mb-1 uppercase tracking-wider">They beat you on:</p>
                        {comp.whatTheyDoBetter.map((w, j) => (
                          <div key={j} className="flex items-start justify-between gap-2">
                            <p className="text-orange-400/70 text-sm">• {w}</p>
                            <CopyBtn text={w} />
                          </div>
                        ))}
                      </div>
                    )}
                    {comp.whatWeLack.length > 0 && (
                      <div>
                        <p className="text-blue-400/60 text-xs mb-1 uppercase tracking-wider">Add to your article:</p>
                        {comp.whatWeLack.map((w, j) => (
                          <div key={j} className="flex items-start justify-between gap-2">
                            <p className="text-blue-400/70 text-sm">→ {w}</p>
                            <CopyBtn text={w} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Internal Links ── */}
        {activeTab === "internal" && (
          <Section title="Internal Link Opportunities"
            action={<CopyBtn text={internalLinkOpportunities.join("\n")} label="copy all" />}>
            <div className="space-y-2">
              {internalLinkOpportunities.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex gap-2 text-sm text-white/60">
                    <span className="text-white/20">→</span> {l}
                  </div>
                  <CopyBtn text={l} />
                </div>
              ))}
            </div>
            {mainArticle && mainArticle.internalLinks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-white/40 text-xs mb-2">Current internal links ({mainArticle.internalLinks.length}):</p>
                {mainArticle.internalLinks.slice(0, 5).map((l, i) => (
                  <p key={i} className="text-white/30 text-xs truncate">• {l.text || l.href}</p>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── AI Search ── */}
        {activeTab === "ai" && (
          <Section title="AI Search Extractability">
            <div className="space-y-4">
              <div>
                <p className="text-green-400/60 text-xs mb-2 uppercase tracking-wider">AI Can Extract</p>
                <div className="space-y-1">
                  {aiSearchFindings.canExtract.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <p className="text-white/60 text-sm">✓ {e}</p>
                      <CopyBtn text={e} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-red-400/60 text-xs mb-2 uppercase tracking-wider">AI Cannot Confidently Extract</p>
                <div className="space-y-1">
                  {aiSearchFindings.cannotExtract.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <p className="text-white/60 text-sm">✗ {e}</p>
                      <CopyBtn text={e} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-white/40 text-xs">Suggested Quick Answer</p>
                  <CopyBtn text={aiSearchFindings.suggestedQuickAnswer} />
                </div>
                <p className="text-white/70 text-sm">{aiSearchFindings.suggestedQuickAnswer}</p>
              </div>
            </div>
          </Section>
        )}

        {/* ── Trust ── */}
        {activeTab === "trust" && (
          <Section title="Trust / E-E-A-T">
            <div className="space-y-3">
              {[
                ["Author", mainArticle?.hasAuthor ? mainArticle.authorName || "Detected" : "MISSING", mainArticle?.hasAuthor],
                ["Publication Date", mainArticle?.hasDate ? mainArticle.dateText || "Detected" : "MISSING", mainArticle?.hasDate],
                ["Official Sources", `${(mainArticle?.officialSourceLinks || []).length} found`, (mainArticle?.officialSourceLinks || []).length > 0],
                ["Overclaims", (mainArticle?.overclaims || []).length === 0 ? "None detected" : (mainArticle?.overclaims || []).join(", "), (mainArticle?.overclaims || []).length === 0],
              ].map(([label, val, good]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-white/50 text-sm">{label as string}</span>
                  <span className={`text-sm ${good ? "text-green-400" : "text-red-400"}`}>{val as string}</span>
                </div>
              ))}
            </div>
            {officialSourceSuggestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-white/40 text-xs mb-2">Suggested Official Sources to Cite</p>
                {officialSourceSuggestions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-white/50 text-sm">• {s}</p>
                    <CopyBtn text={s} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Freshness ── */}
        {activeTab === "freshness" && (
          <Section title="Freshness Risks"
            action={freshnessRisks.length > 0 ? <CopyBtn text={freshnessRisks.join("\n")} label="copy all" /> : undefined}>
            {freshnessRisks.length === 0 ? (
              <p className="text-green-400/60 text-sm">No major freshness risks detected.</p>
            ) : (
              <div className="space-y-2">
                {freshnessRisks.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-orange-400/70 text-sm">⚠ {r}</p>
                    <CopyBtn text={r} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Conversion ── */}
        {activeTab === "conversion" && (
          <Section title="Conversion Path Issues"
            action={conversionIssues.length > 0 ? <CopyBtn text={conversionIssues.join("\n")} label="copy all" /> : undefined}>
            {conversionIssues.length === 0 ? (
              <p className="text-green-400/60 text-sm">Conversion path looks adequate.</p>
            ) : (
              <div className="space-y-2">
                {conversionIssues.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-orange-400/70 text-sm">→ {c}</p>
                    <CopyBtn text={c} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Exports ── */}
        {activeTab === "exports" && (
          <Section title="Export Everything">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Copy Rewrite Prompt", sub: "Paste into AI → full article", text: aiRewritePrompt, copy: true },
                { label: "Copy Full Report", sub: "Markdown — paste anywhere", text: markdownReport, copy: true },
                { label: "Copy 24h Task List", sub: "Action items for today", text: actionPlan24h.join("\n"), copy: true },
                { label: "Copy All Titles", sub: "7 title options", text: titleOptions.join("\n"), copy: true },
                { label: "Copy All H2s", sub: "Content structure", text: h2Suggestions.join("\n"), copy: true },
                { label: "Copy All FAQs", sub: "Q&A pairs ready to paste", text: faqSuggestions.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"), copy: true },
              ].map((item) => (
                <CopyExportBtn key={item.label} label={item.label} sub={item.sub} text={item.text} />
              ))}
              <button onClick={() => downloadFile(markdownReport, "rankgod-report.md")}
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl p-4 text-left transition-colors">
                <p className="text-white/80 text-sm font-medium">Download Markdown</p>
                <p className="text-white/30 text-xs mt-1">Full report as .md file</p>
              </button>
              <button onClick={() => downloadFile(JSON.stringify(result, null, 2), "rankgod-data.json", "application/json")}
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl p-4 text-left transition-colors">
                <p className="text-white/80 text-sm font-medium">Download JSON</p>
                <p className="text-white/30 text-xs mt-1">Raw data for integration</p>
              </button>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function CopyExportBtn({ label, sub, text }: { label: string; sub: string; text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button onClick={copy} className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl p-4 text-left transition-colors">
      <p className="text-white/80 text-sm font-medium">{done ? "✓ Copied!" : label}</p>
      <p className="text-white/30 text-xs mt-1">{sub}</p>
    </button>
  );
}
