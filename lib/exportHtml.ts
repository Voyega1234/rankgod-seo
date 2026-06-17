/**
 * HTML Export — blueprint-based report using site's own brand colors
 * White background, printable to PDF, Thai language
 */
import type { SiteAuditResult } from "./siteAudit";
import type { SeoIssue } from "./scorer";

// ─── Color helpers ────────────────────────────────────────────────────────────

function pickBrandColors(colors: string[]): { primary: string; accent: string; light: string } {
  const defaults = { primary: "#1e40af", accent: "#3b82f6", light: "#eff6ff" };
  if (!colors || colors.length === 0) return defaults;
  const primary = colors[0] || defaults.primary;
  const accent = colors[1] || colors[0] || defaults.accent;
  const light = hexToLight(primary);
  return { primary, accent, light };
}

function hexToLight(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.08)`;
  } catch {
    return "#eff6ff";
  }
}

function priorityColor(p: SeoIssue["priority"]): string {
  return { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#64748b" }[p];
}

function priorityBg(p: SeoIssue["priority"]): string {
  return { critical: "#fef2f2", high: "#fff7ed", medium: "#fffbeb", low: "#f8fafc" }[p];
}

function priorityLabel(p: SeoIssue["priority"]): string {
  return { critical: "วิกฤต", high: "สูง", medium: "ปานกลาง", low: "ต่ำ" }[p];
}

function scoreColor(n: number): string {
  return n >= 8 ? "#16a34a" : n >= 5 ? "#d97706" : "#dc2626";
}

function scoreGrade(n: number): string {
  return n >= 8 ? "A" : n >= 6 ? "B" : n >= 4 ? "C" : n >= 2 ? "D" : "F";
}

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildIssueCards(issues: SeoIssue[], primary: string): string {
  return issues.map((iss, i) => `
  <div class="issue-card" style="border-left:4px solid ${priorityColor(iss.priority)};background:${priorityBg(iss.priority)}">
    <div class="issue-header">
      <span class="badge" style="background:${priorityColor(iss.priority)}20;color:${priorityColor(iss.priority)};border:1px solid ${priorityColor(iss.priority)}40">${priorityLabel(iss.priority)}</span>
      <span class="badge cat">${iss.category.toUpperCase()}</span>
      <span class="effort">ใช้เวลา ${iss.effortDays} วัน · ผลกระทบ ${iss.impactLevel}</span>
    </div>
    <div class="issue-title">${i + 1}. ${escHtml(iss.title)}</div>
    <div class="issue-grid">
      <div class="iblock">
        <div class="iblock-label">ผลกระทบ</div>
        <ul>${iss.impact.map(t => `<li>${escHtml(t)}</li>`).join("")}</ul>
      </div>
      <div class="iblock highlight">
        <div class="iblock-label">วิธีแก้ไข</div>
        <ul>${iss.fix.map(t => `<li>${escHtml(t)}</li>`).join("")}</ul>
      </div>
    </div>
    ${iss.found.length > 0 ? `
    <div class="found-row">
      <span style="font-size:11px;color:#94a3b8">หลักฐานที่พบ:</span>
      ${iss.found.slice(0, 4).map(f => {
        const label = f.url || f.page || f.label || f.note || "";
        const sub = f.current || (f.status ? `status: ${f.status}` : "") || (f.value ? `${f.value}` : "") || "";
        return `<span class="found-chip" title="${escHtml(String(label))}">${escHtml(String(label).slice(0, 60))}${sub ? `<span class="found-sub">${escHtml(String(sub).slice(0, 40))}</span>` : ""}</span>`;
      }).join("")}
    </div>` : ""}
  </div>`).join("");
}

function buildScoreRing(label: string, val: number, primary: string): string {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * (val / 10);
  const color = scoreColor(val);
  const grade = scoreGrade(val);
  return `
  <div class="score-cell">
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="7"/>
      <circle cx="45" cy="45" r="${r}" fill="none" stroke="${color}" stroke-width="7"
        stroke-dasharray="${circ}" stroke-dashoffset="${circ - dash}"
        stroke-linecap="round" transform="rotate(-90 45 45)"/>
      <text x="45" y="42" text-anchor="middle" font-size="18" font-weight="900" fill="${color}" font-family="Sarabun,sans-serif">${grade}</text>
      <text x="45" y="56" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Sarabun,sans-serif">${val}/10</text>
    </svg>
    <div class="score-label">${label}</div>
  </div>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateSalesHtml(result: SiteAuditResult): string {
  const { primary, accent, light } = pickBrandColors(result.brandColors);
  const domain = result.domain.replace(/^https?:\/\//, "");
  const date = new Date(result.crawledAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

  const s = result.scores;
  const overallGrade = scoreGrade(s.overall);
  const overallColor = scoreColor(s.overall);
  const circ = 2 * Math.PI * 58;

  const allIssues = [
    ...result.issues.critical,
    ...result.issues.high,
    ...result.issues.medium,
    ...result.issues.low,
  ];

  const ai = result.aiAnalysis;

  // ── AI sections ──────────────────────────────────────────────────────────

  const aiOverview = ai ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">🤖 AI Senior SEO Analysis</div>
    <p class="section-desc">วิเคราะห์โดย Claude AI — ผู้เชี่ยวชาญ SEO ระดับ Senior สำหรับทุกประเภทธุรกิจ</p>

    <div class="ai-box">
      <div class="ai-verdict">${escHtml(ai.overallVerdict)}</div>
      <div class="ai-tags">
        <span class="ai-tag">ธุรกิจ: ${escHtml(ai.businessType)}</span>
        <span class="ai-tag">กลุ่มเป้าหมาย: ${escHtml(ai.targetAudience)}</span>
        <span class="ai-tag">ระดับ SEO: ${escHtml(ai.currentSeoMaturity)}</span>
      </div>
    </div>

    ${ai.siteStructureAnalysis ? `
    <div class="subsection">
      <div class="subsection-title">โครงสร้างเว็บ</div>
      <p class="body-text">${escHtml(ai.siteStructureAnalysis)}</p>
    </div>` : ""}

    ${ai.whatIsWorking?.length > 0 ? `
    <div class="subsection">
      <div class="subsection-title">สิ่งที่ทำดีอยู่แล้ว</div>
      <div class="check-list">
        ${ai.whatIsWorking.map(t => `<div class="check-item"><span class="check-icon" style="color:${primary}">✓</span>${escHtml(t)}</div>`).join("")}
      </div>
    </div>` : ""}

    ${ai.contentGaps?.length > 0 ? `
    <div class="subsection">
      <div class="subsection-title">Content ที่ยังขาด (โอกาสที่พลาดไป)</div>
      <div class="gap-list">
        ${ai.contentGaps.map(t => `<div class="gap-item"><span style="color:#dc2626">●</span> ${escHtml(t)}</div>`).join("")}
      </div>
    </div>` : ""}
  </div>` : "";

  const aiLandingPages = ai && ai.landingPages && ai.landingPages.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">📄 Landing Pages หลักที่วิเคราะห์แล้ว</div>
    <p class="section-desc">หน้าสำคัญที่มีโอกาส rank ใน Google</p>
    <div class="lp-grid">
      ${ai.landingPages.slice(0, 10).map(lp => `
      <div class="lp-card">
        <div class="lp-url">${escHtml(lp.url)}</div>
        <div class="lp-topic">${escHtml(lp.topic)}</div>
        <div class="lp-strength">${escHtml(lp.strength)}</div>
        ${lp.keywords?.length > 0 ? `<div class="lp-keywords">${lp.keywords.map(k => `<span class="kw-chip">${escHtml(k)}</span>`).join("")}</div>` : ""}
        ${lp.wordCount > 0 ? `<div class="lp-words">${lp.wordCount} คำ</div>` : ""}
      </div>`).join("")}
    </div>
  </div>` : "";

  const aiKeywords = ai && ai.keywordSignals && ai.keywordSignals.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">🔑 Keyword Signals ที่พบ</div>
    <p class="section-desc">keyword ที่ detect ได้จากเนื้อหาจริงในเว็บ พร้อมศักยภาพ</p>
    <table class="kw-table">
      <thead>
        <tr>
          <th>Keyword</th>
          <th>พบใน</th>
          <th>Search Intent</th>
          <th style="text-align:center">ศักยภาพ</th>
        </tr>
      </thead>
      <tbody>
        ${ai.keywordSignals.map(kw => {
          const potColor = { สูงมาก: "#16a34a", สูง: "#65a30d", กลาง: "#d97706", ต่ำ: "#94a3b8" }[kw.potential] || "#94a3b8";
          return `<tr>
            <td><strong>${escHtml(kw.keyword)}</strong></td>
            <td style="font-size:11px;color:#64748b">${escHtml(kw.foundIn)}</td>
            <td style="font-size:12px">${escHtml(kw.searchIntent)}</td>
            <td style="text-align:center"><span class="pot-badge" style="background:${potColor}20;color:${potColor};border:1px solid ${potColor}40">${kw.potential}</span></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>` : "";

  const aiKeywordSuggestions = ai && ai.keywordSuggestions && ai.keywordSuggestions.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">💡 Keyword Suggestions — กลุ่ม Keyword ที่ควร Target</div>
    <p class="section-desc">Keyword groups ที่แนะนำให้ธุรกิจนี้โฟกัส — วิเคราะห์จากธุรกิจจริงและ content ที่มีในเว็บ</p>
    <div class="ks-grid">
      ${ai.keywordSuggestions.map((ks, idx) => {
        const prioColor = { สูงมาก: "#dc2626", สูง: "#ea580c", กลาง: "#d97706" }[ks.priority] || "#d97706";
        const priBg = { สูงมาก: "#fef2f2", สูง: "#fff7ed", กลาง: "#fffbeb" }[ks.priority] || "#fffbeb";
        const intentColor = { transactional: "#7c3aed", commercial: "#0891b2", informational: "#059669", navigational: "#64748b" }[ks.searchIntent] || "#64748b";
        return `
      <div class="ks-card" style="border-left:4px solid ${prioColor};background:${priBg}">
        <div class="ks-header">
          <div class="ks-num" style="color:${prioColor}">#${idx + 1}</div>
          <div class="ks-group">${escHtml(ks.group)}</div>
          <span class="ks-prio" style="background:${prioColor}20;color:${prioColor};border:1px solid ${prioColor}40">${escHtml(ks.priority)}</span>
        </div>
        <div class="ks-intent"><span style="background:${intentColor}15;color:${intentColor};border:1px solid ${intentColor}30;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase">${escHtml(ks.searchIntent)}</span></div>
        <div class="ks-keywords">
          ${(ks.keywords || []).map(k => `<span class="ks-kw">${escHtml(k)}</span>`).join("")}
        </div>
        <div class="ks-reason">${escHtml(ks.reason)}</div>
        ${ks.suggestedPage ? `<div class="ks-page"><span style="color:#94a3b8;font-size:11px">หน้าที่แนะนำ:</span> <code style="font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:3px;color:${primary}">${escHtml(ks.suggestedPage)}</code></div>` : ""}
      </div>`;
      }).join("")}
    </div>
  </div>` : "";

  const aiCompetitors = ai && ai.competitors && ai.competitors.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">🏆 Competitor ที่ควรโฟกัส</div>
    <p class="section-desc">คู่แข่งหลักในอุตสาหกรรมเดียวกัน — วิเคราะห์จุดแข็งและช่องว่างที่เราเอาชนะได้</p>
    <div class="comp-grid">
      ${ai.competitors.map((comp, idx) => `
      <div class="comp-card">
        <div class="comp-header" style="background:${light};border-bottom:2px solid ${primary}20">
          <div class="comp-rank" style="color:${primary}">#${idx + 1}</div>
          <div class="comp-info">
            <div class="comp-name">${escHtml(comp.name)}</div>
            <div class="comp-domain">${escHtml(comp.domain)}</div>
          </div>
        </div>
        <div class="comp-why">${escHtml(comp.whyFocus)}</div>
        ${comp.theirStrengths?.length > 0 ? `
        <div class="comp-section">
          <div class="comp-section-title" style="color:#ea580c">⚡ จุดแข็งของเขา</div>
          ${comp.theirStrengths.map(s => `<div class="comp-item comp-str">• ${escHtml(s)}</div>`).join("")}
        </div>` : ""}
        ${comp.gaps?.length > 0 ? `
        <div class="comp-section">
          <div class="comp-section-title" style="color:#16a34a">🎯 ช่องว่าง — โอกาสของเรา</div>
          ${comp.gaps.map(g => `<div class="comp-item comp-gap">• ${escHtml(g)}</div>`).join("")}
        </div>` : ""}
      </div>`).join("")}
    </div>
  </div>` : "";

  const aiDetailedSitemap = ai && ai.detailedSitemap && ai.detailedSitemap.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">🗂️ โครงสร้าง Sitemap ละเอียด — ภาพรวมทุกหน้าที่ควรมี</div>
    <p class="section-desc">วางโครงสร้างเว็บจาก keyword ทั้งหมด — ทีมเห็นภาพชัดว่าต้องสร้างหน้าอะไรเพิ่ม และปรับหน้าไหน</p>
    <div class="dmap-root">
      <div class="dmap-home">
        <span class="dmap-home-icon">🏠</span>
        <span class="dmap-home-title">${escHtml(domain)} — Homepage</span>
        <span class="dmap-home-badge">Root</span>
      </div>
      <div class="dmap-sections">
        ${ai.detailedSitemap.map(sec => `
        <div class="dmap-section">
          <div class="dmap-section-head">
            <span class="dmap-icon">${escHtml(sec.icon)}</span>
            <span class="dmap-section-name">${escHtml(sec.section)}</span>
            <span class="dmap-page-count">${sec.pages?.length || 0} หน้า</span>
          </div>
          <div class="dmap-pages">
            ${(sec.pages || []).map(pg => {
              const pgPrioColor = { high: "#dc2626", medium: "#d97706", low: "#94a3b8" }[pg.priority] || "#94a3b8";
              const pgPrioLabel = { high: "สำคัญสูง", medium: "ปานกลาง", low: "ต่ำ" }[pg.priority] || "";
              const isNew = (pg.note || "").includes("สร้างใหม่") || (pg.note || "").includes("ต้องสร้าง");
              return `
            <div class="dmap-page" style="border-left:3px solid ${pgPrioColor}">
              <div class="dmap-page-top">
                <span class="dmap-slug">${escHtml(pg.slug)}</span>
                <span class="dmap-page-type">${escHtml(pg.pageType)}</span>
                <span class="dmap-prio" style="color:${pgPrioColor};background:${pgPrioColor}15;border:1px solid ${pgPrioColor}30">${pgPrioLabel}</span>
                ${isNew ? `<span class="dmap-new-badge">✦ ใหม่</span>` : ""}
              </div>
              <div class="dmap-page-title">${escHtml(pg.title)}</div>
              ${pg.targetKeywords?.length > 0 ? `<div class="dmap-kws">${pg.targetKeywords.map(k => `<span class="dmap-kw">${escHtml(k)}</span>`).join("")}</div>` : ""}
              ${pg.note ? `<div class="dmap-note">${escHtml(pg.note)}</div>` : ""}
            </div>`;
            }).join("")}
          </div>
        </div>`).join("")}
      </div>
    </div>
  </div>` : "";

  const aiTeamActions = ai && ai.teamActions && ai.teamActions.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">👥 งานที่แต่ละทีมต้องทำ</div>
    <p class="section-desc">แผนงานแยกตามบทบาท ทีม Sales นำไปเสนอลูกค้าได้เลย</p>
    <div class="team-grid">
      ${ai.teamActions.map(ta => {
        const prioColor = { ด่วน: "#dc2626", สำคัญ: "#ea580c", ทำเพิ่ม: "#64748b" }[ta.priority] || "#64748b";
        return `
      <div class="team-card">
        <div class="team-header" style="background:${light};color:${primary}">
          <span class="team-role">${escHtml(ta.role)}</span>
          <span class="team-prio" style="color:${prioColor}">${escHtml(ta.priority)}</span>
        </div>
        <div class="team-time">${escHtml(ta.timeframe)}</div>
        <ul class="team-actions">
          ${ta.actions.map(a => `<li>${escHtml(a)}</li>`).join("")}
        </ul>
      </div>`;
      }).join("")}
    </div>
  </div>` : "";

  const aiActionPlan = ai && ai.actionPlan && ai.actionPlan.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">📅 Action Plan — แผน 4 Phase</div>
    <p class="section-desc">ลำดับขั้นตอนที่แนะนำ พร้อม expected impact ของแต่ละ phase</p>
    <div class="phase-grid">
      ${ai.actionPlan.map(ph => {
        const phColors = ["#dc2626","#ea580c","#d97706","#16a34a"];
        const c = phColors[(ph.phase - 1) % phColors.length];
        return `
      <div class="phase-card">
        <div class="phase-header" style="background:${c}10;border-left:4px solid ${c}">
          <div class="phase-num" style="color:${c}">Phase ${ph.phase}</div>
          <div class="phase-name">${escHtml(ph.name)}</div>
          <div class="phase-duration">${escHtml(ph.duration)}</div>
        </div>
        <div class="phase-focus">${escHtml(ph.focus)}</div>
        <ul class="phase-tasks">
          ${ph.tasks.map(t => `<li>${escHtml(t)}</li>`).join("")}
        </ul>
        ${ph.expectedImpact ? `<div class="phase-impact" style="color:${c}">ผล: ${escHtml(ph.expectedImpact)}</div>` : ""}
      </div>`;
      }).join("")}
    </div>
  </div>` : "";

  const aiExpected = ai?.expectedResults ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">📈 ผลลัพธ์ที่คาดหวัง</div>
    <p class="section-desc">ประมาณการผลลัพธ์จริงหลังจากดำเนิน action plan</p>
    <div class="expected-grid">
      <div class="exp-col" style="border-top:3px solid #d97706">
        <div class="exp-header" style="color:#d97706">30 วันแรก</div>
        ${ai.expectedResults.day30?.map(t => `<div class="exp-item">• ${escHtml(t)}</div>`).join("") || ""}
      </div>
      <div class="exp-col" style="border-top:3px solid ${primary}">
        <div class="exp-header" style="color:${primary}">60 วัน</div>
        ${ai.expectedResults.day60?.map(t => `<div class="exp-item">• ${escHtml(t)}</div>`).join("") || ""}
      </div>
      <div class="exp-col" style="border-top:3px solid #16a34a">
        <div class="exp-header" style="color:#16a34a">90 วัน</div>
        ${ai.expectedResults.day90?.map(t => `<div class="exp-item">• ${escHtml(t)}</div>`).join("") || ""}
      </div>
    </div>
  </div>` : "";

  const aiSalesPitch = ai?.salesPitchSummary ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">💼 Sales Pitch Summary</div>
    <p class="section-desc">สรุปสำหรับทีม Sales นำไปพูดกับลูกค้าได้ทันที</p>
    <div class="pitch-box" style="border-left:4px solid ${primary};background:${light}">
      <p class="body-text">${escHtml(ai.salesPitchSummary)}</p>
    </div>
  </div>` : "";

  const aiExecutive = ai?.executiveSummary ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">📋 Executive Summary</div>
    <p class="section-desc">สรุปสำหรับผู้บริหารลูกค้า</p>
    <div class="exec-box">
      <p class="body-text">${escHtml(ai.executiveSummary)}</p>
    </div>
    ${ai.competitiveEdge ? `
    <div class="subsection" style="margin-top:20px">
      <div class="subsection-title">จุดได้เปรียบ / เสียเปรียบเทียบ Competitor</div>
      <p class="body-text">${escHtml(ai.competitiveEdge)}</p>
    </div>` : ""}
  </div>` : "";

  // ── Strengths ─────────────────────────────────────────────────────────────

  const strengthsSection = result.strengths.length > 0 ? `
  <div class="section">
    <div class="section-title" style="color:#16a34a">✅ จุดแข็ง — สิ่งที่ทำดีอยู่แล้ว</div>
    <p class="section-desc">สิ่งเหล่านี้ดีอยู่แล้ว ไม่ต้องเปลี่ยน</p>
    <div class="check-list">
      ${result.strengths.map(s => `<div class="check-item"><span class="check-icon" style="color:#16a34a">✓</span>${escHtml(s)}</div>`).join("")}
    </div>
  </div>` : "";

  // ── Sitemap recommended ───────────────────────────────────────────────────

  const sr = result.sitemapRecommended;
  const sitemapSection = `
  <div class="section">
    <div class="section-title" style="color:${primary}">🗺️ Sitemap ที่แนะนำ</div>
    <p class="section-desc">โครงสร้าง sitemap.xml ที่ควรมีตามเนื้อหาเว็บ</p>
    <div class="sitemap-box">
      <div class="sm-item sm-root">/ — Homepage</div>
      ${sr.collections.slice(0, 8).map(c => `<div class="sm-item sm-l1">├── ${escHtml(c)}</div>`).join("")}
      ${sr.products ? `<div class="sm-item sm-l1">├── ${escHtml(sr.products)}</div>` : ""}
      ${sr.pages.slice(0, 5).map(p => `<div class="sm-item sm-l1">├── ${escHtml(p)}</div>`).join("")}
      ${sr.blogs.slice(0, 4).map(b => `<div class="sm-item sm-l1">├── ${escHtml(b)}</div>`).join("")}
      ${sr.other.slice(0, 3).map(o => `<div class="sm-item sm-l1">└── ${escHtml(o)}</div>`).join("")}
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:12px">* สร้าง sitemap.xml ครอบคลุม URL ข้างต้น แล้ว Submit ใน Google Search Console</p>
  </div>`;

  // ── Pages table ───────────────────────────────────────────────────────────

  const pagesSection = `
  <div class="section">
    <div class="section-title" style="color:${primary}">📋 หน้าที่ Scan ได้ทั้งหมด</div>
    <p class="section-desc">Scan ครบ ${result.pageCount} หน้า · Discovered ${result.discoveredUrlCount} URL · แสดง ${Math.min(40, result.topPages.length)} หน้าที่มีเนื้อหามากที่สุด</p>
    <table class="pages-table">
      <thead>
        <tr>
          <th style="width:50px">#</th>
          <th>URL</th>
          <th style="width:60px">ประเภท</th>
          <th style="width:60px">คำ</th>
          <th style="width:40px">H1</th>
          <th style="width:40px">Meta</th>
          <th style="width:50px">Schema</th>
          <th style="width:50px">Links</th>
        </tr>
      </thead>
      <tbody>
        ${result.topPages.map((p, i) => {
          const typeColors: Record<string, string> = { home: primary, product: "#7c3aed", collection: "#0891b2", blog: "#059669", faq: "#d97706", about: "#64748b", contact: "#64748b", policy: "#94a3b8", other: "#e2e8f0" };
          const tc = typeColors[p.type] || "#64748b";
          const urlShort = p.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 55) || "/";
          return `<tr>
            <td style="text-align:center;color:#94a3b8;font-size:11px">${i + 1}</td>
            <td style="font-size:11px;word-break:break-all" title="${escHtml(p.url)}">${escHtml(urlShort)}</td>
            <td style="text-align:center"><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${tc}20;color:${tc}">${p.type}</span></td>
            <td style="text-align:center;font-size:12px">${p.wordCount}</td>
            <td style="text-align:center;color:${p.h1 ? "#16a34a" : "#dc2626"};font-size:13px">${p.h1 ? "✓" : "✗"}</td>
            <td style="text-align:center;color:${p.metaDescription ? "#16a34a" : "#dc2626"};font-size:13px">${p.metaDescription ? "✓" : "✗"}</td>
            <td style="text-align:center;color:${p.schemas.length > 0 ? "#16a34a" : "#dc2626"};font-size:13px">${p.schemas.length > 0 ? "✓" : "✗"}</td>
            <td style="text-align:center;font-size:12px">${p.internalLinks}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    ${result.pageCount > 40 ? `<p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:12px">... และอีก ${result.pageCount - 40} หน้า</p>` : ""}
  </div>`;

  // ── HTML ──────────────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SEO Audit — ${domain}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');

* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Sarabun',sans-serif; background:#fff; color:#1e293b; font-size:14px; line-height:1.7; }
.wrap { max-width:960px; margin:0 auto; background:#fff; }

/* ── Cover ── */
.cover { background:#fff; border-bottom:3px solid ${primary}; padding:52px 64px 44px; }
.cover-logo { font-size:11px; font-weight:700; letter-spacing:0.3em; color:#94a3b8; text-transform:uppercase; margin-bottom:40px; display:flex; align-items:center; gap:8px; }
.cover-logo-dot { width:8px; height:8px; border-radius:50%; background:${primary}; display:inline-block; }
.cover-report-type { font-size:13px; color:#94a3b8; margin-bottom:8px; }
.cover-domain { font-size:36px; font-weight:900; color:#0f172a; word-break:break-all; line-height:1.2; margin-bottom:6px; }
.cover-domain span { color:${primary}; }
.cover-sub { font-size:13px; color:#94a3b8; margin-bottom:44px; }

.cover-scores { display:flex; gap:28px; flex-wrap:wrap; align-items:center; margin-bottom:36px; }
.score-cell { text-align:center; }
.score-label { font-size:11px; color:#64748b; margin-top:4px; font-weight:600; }

.cover-stats { display:flex; gap:28px; flex-wrap:wrap; }
.cs { border:1px solid #e2e8f0; border-radius:12px; padding:14px 20px; min-width:90px; }
.cs-num { font-size:24px; font-weight:800; }
.cs-label { font-size:11px; color:#94a3b8; margin-top:2px; }

.cover-date { font-size:12px; color:#94a3b8; }

/* ── Priority row ── */
.priority-section { padding:32px 64px; border-bottom:1px solid #f1f5f9; display:flex; gap:12px; flex-wrap:wrap; }
.prio-box { flex:1; min-width:120px; border-radius:12px; padding:16px 18px; border:1px solid; }

/* ── Sections ── */
.section { padding:40px 64px; border-bottom:1px solid #f1f5f9; }
.section:last-child { border-bottom:none; }
.section-title { font-size:17px; font-weight:800; color:#0f172a; margin-bottom:6px; }
.section-desc { font-size:13px; color:#64748b; margin-bottom:24px; }

.subsection { margin-top:24px; }
.subsection-title { font-size:13px; font-weight:700; color:#334155; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em; }
.body-text { font-size:14px; color:#334155; line-height:1.8; }

/* ── Issues ── */
.issue-card { border-radius:12px; padding:22px 24px; margin-bottom:16px; border:1px solid #e2e8f0; }
.issue-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.badge { font-size:10px; font-weight:700; padding:3px 9px; border-radius:5px; text-transform:uppercase; letter-spacing:0.05em; }
.cat { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
.effort { font-size:11px; color:#94a3b8; margin-left:auto; }
.issue-title { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:14px; }
.issue-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
.iblock { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; }
.iblock.highlight { background:#f0fdf4; border-color:#bbf7d0; }
.iblock-label { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
.iblock ul { padding-left:14px; font-size:13px; color:#334155; line-height:1.7; }
.found-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; align-items:flex-start; }
.found-chip { font-size:10px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:3px 8px; color:#475569; word-break:break-all; max-width:240px; display:flex; flex-direction:column; }
.found-sub { color:#94a3b8; font-size:10px; }

/* ── AI ── */
.ai-box { background:${light}; border:1px solid ${primary}30; border-radius:12px; padding:20px 24px; margin-bottom:20px; }
.ai-verdict { font-size:15px; color:#0f172a; line-height:1.8; margin-bottom:12px; }
.ai-tags { display:flex; gap:8px; flex-wrap:wrap; }
.ai-tag { font-size:11px; background:#fff; border:1px solid ${primary}30; border-radius:6px; padding:3px 10px; color:${primary}; font-weight:600; }
.check-list { display:flex; flex-direction:column; gap:6px; }
.check-item { display:flex; gap:8px; align-items:flex-start; font-size:14px; color:#334155; }
.check-icon { font-weight:900; flex-shrink:0; }
.gap-list { display:flex; flex-direction:column; gap:6px; }
.gap-item { font-size:13px; color:#334155; display:flex; gap:8px; align-items:flex-start; }

/* ── Landing pages ── */
.lp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
.lp-card { border:1px solid #e2e8f0; border-radius:10px; padding:16px; }
.lp-url { font-size:11px; color:#94a3b8; word-break:break-all; margin-bottom:4px; }
.lp-topic { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:4px; }
.lp-strength { font-size:12px; color:#64748b; line-height:1.6; margin-bottom:8px; }
.lp-keywords { display:flex; flex-wrap:wrap; gap:4px; }
.kw-chip { font-size:10px; background:${light}; color:${primary}; border:1px solid ${primary}20; border-radius:4px; padding:2px 7px; }
.lp-words { font-size:11px; color:#94a3b8; margin-top:6px; }

/* ── Keyword table ── */
.kw-table { width:100%; border-collapse:collapse; }
.kw-table thead th { background:#f8fafc; padding:9px 12px; text-align:left; font-weight:700; color:#64748b; font-size:11px; border-bottom:2px solid #e2e8f0; }
.kw-table tbody td { padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:13px; vertical-align:middle; }
.kw-table tbody tr:hover { background:#fafafa; }
.pot-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:5px; }

/* ── Team ── */
.team-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }
.team-card { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
.team-header { padding:12px 16px; display:flex; justify-content:space-between; align-items:center; }
.team-role { font-weight:700; font-size:13px; }
.team-prio { font-size:11px; font-weight:700; }
.team-time { font-size:11px; color:#94a3b8; padding:6px 16px; border-bottom:1px solid #f1f5f9; }
.team-actions { padding:10px 16px 14px 28px; font-size:13px; color:#334155; line-height:1.8; }

/* ── Phases ── */
.phase-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; }
.phase-card { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
.phase-header { padding:12px 14px; }
.phase-num { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; }
.phase-name { font-size:13px; font-weight:700; color:#0f172a; margin-top:2px; }
.phase-duration { font-size:11px; color:#94a3b8; margin-top:2px; }
.phase-focus { font-size:12px; color:#64748b; padding:8px 14px; border-bottom:1px solid #f1f5f9; }
.phase-tasks { padding:8px 14px 12px 26px; font-size:12px; color:#334155; line-height:1.8; }
.phase-impact { font-size:12px; font-weight:600; padding:8px 14px; border-top:1px solid #f1f5f9; }

/* ── Expected results ── */
.expected-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.exp-col { border:1px solid #e2e8f0; border-radius:10px; padding:16px; padding-top:20px; }
.exp-header { font-size:13px; font-weight:700; margin-bottom:12px; }
.exp-item { font-size:13px; color:#334155; padding:4px 0; border-bottom:1px solid #f8fafc; }

/* ── Keyword suggestions ── */
.ks-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
.ks-card { border:1px solid #e2e8f0; border-radius:10px; padding:16px 18px; }
.ks-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.ks-num { font-size:11px; font-weight:800; flex-shrink:0; }
.ks-group { font-size:14px; font-weight:700; color:#0f172a; flex:1; line-height:1.3; }
.ks-prio { font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; white-space:nowrap; }
.ks-intent { margin-bottom:8px; }
.ks-keywords { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; }
.ks-kw { font-size:11px; background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:2px 8px; color:#475569; }
.ks-reason { font-size:12px; color:#64748b; line-height:1.6; margin-bottom:6px; }
.ks-page { font-size:11px; color:#94a3b8; }

/* ── Competitors ── */
.comp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
.comp-card { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
.comp-header { display:flex; align-items:center; gap:10px; padding:14px 16px; }
.comp-rank { font-size:20px; font-weight:900; flex-shrink:0; }
.comp-info { flex:1; min-width:0; }
.comp-name { font-size:14px; font-weight:700; color:#0f172a; }
.comp-domain { font-size:11px; color:#94a3b8; }
.comp-why { font-size:12px; color:#64748b; line-height:1.6; padding:8px 16px; border-bottom:1px solid #f1f5f9; }
.comp-section { padding:10px 16px; }
.comp-section-title { font-size:11px; font-weight:700; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em; }
.comp-item { font-size:12px; color:#334155; line-height:1.65; padding:1px 0; }
.comp-str { color:#475569; }
.comp-gap { color:#166534; }

/* ── Detailed sitemap ── */
.dmap-root { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
.dmap-home { background:${primary}; color:#fff; padding:16px 22px; display:flex; align-items:center; gap:10px; }
.dmap-home-icon { font-size:18px; }
.dmap-home-title { font-size:14px; font-weight:700; flex:1; }
.dmap-home-badge { font-size:10px; font-weight:700; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.3); border-radius:4px; padding:2px 8px; }
.dmap-sections { padding:14px; display:flex; flex-direction:column; gap:12px; }
.dmap-section { background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
.dmap-section-head { display:flex; align-items:center; gap:8px; padding:11px 16px; background:${light}; border-bottom:1px solid #e2e8f0; }
.dmap-icon { font-size:16px; }
.dmap-section-name { font-size:13px; font-weight:700; color:#0f172a; flex:1; }
.dmap-page-count { font-size:11px; color:#94a3b8; font-weight:600; }
.dmap-pages { padding:8px 12px; display:flex; flex-direction:column; gap:7px; }
.dmap-page { background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:10px 12px; }
.dmap-page-top { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
.dmap-slug { font-family:monospace; font-size:11px; color:#475569; font-weight:600; }
.dmap-page-type { font-size:10px; background:#e2e8f0; color:#64748b; border-radius:3px; padding:1px 6px; text-transform:uppercase; font-weight:700; }
.dmap-prio { font-size:10px; font-weight:700; padding:1px 7px; border-radius:4px; }
.dmap-new-badge { font-size:10px; font-weight:700; background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; border-radius:4px; padding:1px 6px; }
.dmap-page-title { font-size:13px; font-weight:600; color:#0f172a; margin-bottom:5px; }
.dmap-kws { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px; }
.dmap-kw { font-size:10px; background:${light}; color:${primary}; border:1px solid ${primary}20; border-radius:3px; padding:1px 6px; }
.dmap-note { font-size:11px; color:#94a3b8; font-style:italic; }

/* ── Sales pitch / executive ── */
.pitch-box { padding:20px 24px; border-radius:0 10px 10px 0; }
.exec-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; }

/* ── Strengths ── */
/* (uses check-list) */

/* ── Sitemap ── */
.sitemap-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; font-size:13px; font-family:monospace; }
.sm-item { padding:3px 0; color:#334155; }
.sm-root { font-weight:700; color:#0f172a; }
.sm-l1 { padding-left:16px; color:#64748b; }

/* ── Pages table ── */
.pages-table { width:100%; border-collapse:collapse; }
.pages-table thead th { background:#f8fafc; padding:9px 10px; text-align:left; font-weight:700; color:#64748b; font-size:11px; border-bottom:2px solid #e2e8f0; }
.pages-table tbody td { padding:8px 10px; border-bottom:1px solid #f8fafc; vertical-align:middle; }
.pages-table tbody tr:hover { background:#fafafa; }

@media print {
  @page { size:A4; margin:14mm 14mm 14mm 14mm; }
  body { background:#fff; }
  .wrap { max-width:100%; box-shadow:none; }
  .section { padding:28px 40px; }
  .cover { padding:36px 40px 32px; }
  .issue-card { page-break-inside:avoid; }
  .phase-card, .lp-card, .team-card { page-break-inside:avoid; }
}
</style>
</head>
<body>
<div class="wrap">

<!-- ══ COVER ═════════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo"><span class="cover-logo-dot"></span>RankGod SEO Intelligence</div>
  <div class="cover-report-type">Full-Site SEO Audit Report</div>
  <div class="cover-domain"><span>${domain.split(".")[0]}</span>.${domain.split(".").slice(1).join(".")}</div>
  <div class="cover-sub">
    Scan ครบ ${result.pageCount} หน้า ·
    Discovered ${result.discoveredUrlCount} URL ·
    ${result.sitemap.found ? "พบ Sitemap.xml" : "ไม่พบ Sitemap"} ·
    ${result.isHttps ? "HTTPS" : "HTTP (ไม่ปลอดภัย)"}
    ${result.isMultiLanguage ? ` · หลายภาษา (${result.languages.join(", ")})` : ""}
  </div>

  <!-- Score rings -->
  <div class="cover-scores">
    <div class="score-cell">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="46" fill="none" stroke="#e2e8f0" stroke-width="9"/>
        <circle cx="55" cy="55" r="46" fill="none" stroke="${overallColor}" stroke-width="9"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ - circ * s.overall / 10}"
          stroke-linecap="round" transform="rotate(-90 55 55)"/>
        <text x="55" y="50" text-anchor="middle" font-size="28" font-weight="900" fill="${overallColor}" font-family="Sarabun,sans-serif">${overallGrade}</text>
        <text x="55" y="67" text-anchor="middle" font-size="13" fill="#94a3b8" font-family="Sarabun,sans-serif">${s.overall}/10</text>
      </svg>
      <div class="score-label">Overall</div>
    </div>
    ${buildScoreRing("Technical", s.technical, primary)}
    ${buildScoreRing("On-Page", s.onpage, primary)}
    ${buildScoreRing("Structure", s.siteStructure, primary)}
    ${buildScoreRing("UX/UI", s.uxUi, primary)}
    ${buildScoreRing("Content", s.contentQuality, primary)}
  </div>

  <div class="cover-stats">
    <div class="cs"><div class="cs-num" style="color:#dc2626">${result.issues.critical.length}</div><div class="cs-label">วิกฤต</div></div>
    <div class="cs"><div class="cs-num" style="color:#ea580c">${result.issues.high.length}</div><div class="cs-label">สูง</div></div>
    <div class="cs"><div class="cs-num" style="color:#d97706">${result.issues.medium.length}</div><div class="cs-label">ปานกลาง</div></div>
    <div class="cs"><div class="cs-num" style="color:#16a34a">${result.strengths.length}</div><div class="cs-label">จุดแข็ง</div></div>
  </div>

  <div class="cover-date" style="margin-top:28px">จัดทำเมื่อ ${date} &nbsp;·&nbsp; วิเคราะห์โดย Claude AI Senior SEO</div>
</div>

<!-- ══ PRIORITY OVERVIEW ═══════════════════════════════════════════════════ -->
<div class="priority-section">
  <div class="prio-box" style="border-color:#fca5a5;background:#fef2f2">
    <div style="font-size:24px;font-weight:900;color:#dc2626">${result.issues.critical.length}</div>
    <div style="font-size:13px;color:#dc2626;margin-top:2px;font-weight:600">🚨 วิกฤต</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px">ส่งผลต่อ ranking ทันที — แก้ด่วนที่สุด</div>
  </div>
  <div class="prio-box" style="border-color:#fed7aa;background:#fff7ed">
    <div style="font-size:24px;font-weight:900;color:#ea580c">${result.issues.high.length}</div>
    <div style="font-size:13px;color:#ea580c;margin-top:2px;font-weight:600">⚠️ สำคัญสูง</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px">แก้ภายใน 1 เดือนแรก</div>
  </div>
  <div class="prio-box" style="border-color:#fde68a;background:#fffbeb">
    <div style="font-size:24px;font-weight:900;color:#d97706">${result.issues.medium.length}</div>
    <div style="font-size:13px;color:#d97706;margin-top:2px;font-weight:600">💡 ปานกลาง</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px">แก้ใน 2-3 เดือน</div>
  </div>
  <div class="prio-box" style="border-color:#bbf7d0;background:#f0fdf4">
    <div style="font-size:24px;font-weight:900;color:#16a34a">${result.strengths.length}</div>
    <div style="font-size:13px;color:#16a34a;margin-top:2px;font-weight:600">✅ จุดแข็ง</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px">สิ่งที่ดีอยู่แล้ว ไม่ต้องแตะ</div>
  </div>
</div>

<!-- ══ AI OVERVIEW ════════════════════════════════════════════════════════ -->
${aiOverview}

<!-- ══ SALES PITCH ════════════════════════════════════════════════════════ -->
${aiSalesPitch}

<!-- ══ ISSUES — CRITICAL ════════════════════════════════════════════════ -->
${result.issues.critical.length > 0 ? `
<div class="section">
  <div class="section-title" style="color:#dc2626">🚨 ปัญหาวิกฤต — ต้องแก้ทันที (${result.issues.critical.length} รายการ)</div>
  <p class="section-desc">ปัญหาเหล่านี้ส่งผลกระทบรุนแรงต่อ SEO ranking — ทีมต้องแก้ก่อนงานอื่นทั้งหมด</p>
  ${buildIssueCards(result.issues.critical, primary)}
</div>` : ""}

<!-- ══ ISSUES — HIGH ═════════════════════════════════════════════════════ -->
${result.issues.high.length > 0 ? `
<div class="section">
  <div class="section-title" style="color:#ea580c">⚠️ ปัญหาสำคัญสูง — แก้ภายใน 1 เดือน (${result.issues.high.length} รายการ)</div>
  <p class="section-desc">ปัญหาที่ส่งผลกระทบต่อ ranking และ conversion อย่างมีนัยสำคัญ</p>
  ${buildIssueCards(result.issues.high, primary)}
</div>` : ""}

<!-- ══ ISSUES — MEDIUM ═══════════════════════════════════════════════════ -->
${result.issues.medium.length > 0 ? `
<div class="section">
  <div class="section-title" style="color:#d97706">💡 ปัญหาปานกลาง — แก้ใน 2-3 เดือน (${result.issues.medium.length} รายการ)</div>
  <p class="section-desc">ปัญหาเหล่านี้ช่วยเพิ่ม competitive edge เมื่อพื้นฐานแก้แล้ว</p>
  ${buildIssueCards(result.issues.medium, primary)}
</div>` : ""}

<!-- ══ STRENGTHS ══════════════════════════════════════════════════════════ -->
${strengthsSection}

<!-- ══ AI LANDING PAGES ══════════════════════════════════════════════════ -->
${aiLandingPages}

<!-- ══ AI KEYWORDS ════════════════════════════════════════════════════════ -->
${aiKeywords}

<!-- ══ KEYWORD SUGGESTIONS ═══════════════════════════════════════════════ -->
${aiKeywordSuggestions}

<!-- ══ COMPETITORS ════════════════════════════════════════════════════════ -->
${aiCompetitors}

<!-- ══ DETAILED SITEMAP ═══════════════════════════════════════════════════ -->
${aiDetailedSitemap}

<!-- ══ AI TEAM ACTIONS ════════════════════════════════════════════════════ -->
${aiTeamActions}

<!-- ══ AI ACTION PLAN ═════════════════════════════════════════════════════ -->
${aiActionPlan}

<!-- ══ EXPECTED RESULTS ══════════════════════════════════════════════════ -->
${aiExpected}

<!-- ══ EXECUTIVE SUMMARY ═════════════════════════════════════════════════ -->
${aiExecutive}

<!-- ══ SITEMAP RECOMMENDED ══════════════════════════════════════════════ -->
${sitemapSection}

<!-- ══ PAGES ══════════════════════════════════════════════════════════════ -->
${pagesSection}

<!-- ══ FOOTER ═════════════════════════════════════════════════════════════ -->
<div style="background:#0f172a;color:#475569;padding:28px 64px;font-size:12px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:4px">RankGod SEO Intelligence</div>
    <div>วิเคราะห์โดย Claude AI Senior SEO · ข้อมูลจริงจาก ${result.pageCount} หน้า</div>
  </div>
  <div style="text-align:right">
    <div style="color:#94a3b8">${domain}</div>
    <div>${date}</div>
  </div>
</div>

</div>
</body>
</html>`;
}
