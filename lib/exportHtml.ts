/**
 * HTML Export — blueprint-based report using site's own brand colors
 * White background, printable to PDF, Thai language
 */
import type { SiteAuditResult, DfsFullData, CostSummary } from "./siteAudit";
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

// ─── DFS Section builders ─────────────────────────────────────────────────────

function buildDfsKeywords(dfs: DfsFullData, primary: string): string {
  const kws = dfs.keywords;
  if (!kws.length) return "";
  const sorted = [...kws].sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
  return `
  <div class="section">
    <div class="section-title" style="color:${primary}">📊 Keyword Intelligence — DataForSEO</div>
    <p class="section-desc">ข้อมูล Search Volume, Difficulty และ Intent จากฐานข้อมูลจริง (ไม่ใช่การคาดเดา)</p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Keyword</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Vol/เดือน</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Difficulty</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">CPC</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Intent</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Location</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.slice(0, 25).map((kw, i) => {
            const diff = kw.keywordDifficulty;
            const diffColor = diff === null ? "#94a3b8" : diff >= 70 ? "#dc2626" : diff >= 40 ? "#d97706" : "#16a34a";
            const intentColor: Record<string,string> = { commercial: "#7c3aed", transactional: "#0891b2", informational: "#059669", navigational: "#64748b" };
            const ic = intentColor[kw.intent] ?? "#94a3b8";
            return `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"};border-bottom:1px solid #f1f5f9">
              <td style="padding:9px 12px;font-weight:600;color:#0f172a">${escHtml(kw.keyword)}</td>
              <td style="padding:9px 12px;text-align:center;font-weight:700;color:${primary}">${kw.searchVolume !== null ? kw.searchVolume.toLocaleString() : "—"}</td>
              <td style="padding:9px 12px;text-align:center">
                ${diff !== null ? `<span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;background:${diffColor}15;color:${diffColor}">${diff}</span>` : "—"}
              </td>
              <td style="padding:9px 12px;text-align:center;color:#64748b">${kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : "—"}</td>
              <td style="padding:9px 12px;text-align:center">
                <span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;background:${ic}15;color:${ic}">${kw.intent}</span>
              </td>
              <td style="padding:9px 12px;color:#64748b;font-size:12px">${escHtml(kw.location)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function buildDfsBacklinks(dfs: DfsFullData, primary: string): string {
  const bl = dfs.backlinks;
  if (!bl) return "";
  return `
  <div class="section">
    <div class="section-title" style="color:${primary}">🔗 Backlink Intelligence — DataForSEO</div>
    <p class="section-desc">ข้อมูล Backlinks จริงจาก DataForSEO — แหล่งอ้างอิงที่ส่งผลต่อ Domain Authority และ Ranking</p>

    <!-- Summary stats -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px">
      ${[
        { label: "Total Backlinks", value: bl.totalBacklinks.toLocaleString(), color: primary },
        { label: "Referring Domains", value: bl.referringDomains.toLocaleString(), color: "#7c3aed" },
        { label: "New (30 วัน)", value: bl.newBacklinks.toLocaleString(), color: "#16a34a" },
        { label: "Lost (30 วัน)", value: bl.lostBacklinks.toLocaleString(), color: "#dc2626" },
        { label: "Domain Rank", value: bl.domainRank !== null ? String(bl.domainRank) : "—", color: "#0891b2" },
      ].map(s => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${s.color}">${escHtml(s.value)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">${s.label}</div>
        </div>`).join("")}
    </div>

    <!-- Top backlinks table -->
    ${bl.topBacklinks.length > 0 ? `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Domain</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Authority</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Type</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Action</th>
          </tr>
        </thead>
        <tbody>
          ${bl.topBacklinks.map((item, i) => `
          <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"};border-bottom:1px solid #f1f5f9">
            <td style="padding:9px 12px;font-weight:600;color:#0f172a;word-break:break-all">${escHtml(item.domain)}</td>
            <td style="padding:9px 12px;text-align:center">
              <span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;
                background:${item.authority >= 60 ? "#16a34a" : item.authority >= 30 ? "#d97706" : "#dc2626"}15;
                color:${item.authority >= 60 ? "#16a34a" : item.authority >= 30 ? "#d97706" : "#dc2626"}">${item.authority}</span>
            </td>
            <td style="padding:9px 12px;text-align:center">
              <span style="padding:2px 8px;border-radius:5px;font-size:10px;background:#f1f5f9;color:#475569">${escHtml(item.type)}</span>
            </td>
            <td style="padding:9px 12px;font-size:12px;color:#64748b">${escHtml(item.suggestedAction)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  </div>`;
}

function buildDfsRankings(dfs: DfsFullData, primary: string): string {
  const rnk = dfs.rankings;
  if (!rnk.length) return "";
  return `
  <div class="section">
    <div class="section-title" style="color:${primary}">📈 Keywords ที่เว็บติดอันดับจริง — DataForSEO</div>
    <p class="section-desc">ดึงจาก DataForSEO Labs — keyword จริงที่ Google index พร้อม volume + difficulty</p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Keyword</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Position</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Vol/เดือน</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Difficulty</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Intent</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rnk.map((r, i) => {
            const pos = r.currentPosition;
            const posColor = pos === null ? "#94a3b8" : pos <= 3 ? "#16a34a" : pos <= 10 ? "#0891b2" : pos <= 20 ? "#d97706" : "#dc2626";
            const posBg = pos === null ? "#f8fafc" : pos <= 3 ? "#f0fdf4" : pos <= 10 ? "#eff6ff" : pos <= 20 ? "#fffbeb" : "#fef2f2";
            const diff = r.keywordDifficulty;
            const diffColor = diff === null ? "#94a3b8" : diff >= 70 ? "#dc2626" : diff >= 40 ? "#d97706" : "#16a34a";
            const intentColor: Record<string,string> = { commercial: "#7c3aed", transactional: "#0891b2", informational: "#059669", navigational: "#64748b" };
            const ic = intentColor[r.intent] ?? "#94a3b8";
            return `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"};border-bottom:1px solid #f1f5f9">
              <td style="padding:9px 12px;font-weight:600;color:#0f172a">${escHtml(r.keyword)}</td>
              <td style="padding:9px 12px;text-align:center">
                <span style="display:inline-block;min-width:44px;padding:3px 10px;border-radius:20px;background:${posBg};font-size:14px;font-weight:900;color:${posColor}">${pos !== null ? `#${pos}` : "—"}</span>
              </td>
              <td style="padding:9px 12px;text-align:center;font-weight:700;color:${primary}">${r.searchVolume !== null ? r.searchVolume.toLocaleString() : "—"}</td>
              <td style="padding:9px 12px;text-align:center">
                ${diff !== null ? `<span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;background:${diffColor}15;color:${diffColor}">${diff}</span>` : "—"}
              </td>
              <td style="padding:9px 12px;text-align:center">
                <span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;background:${ic}15;color:${ic}">${r.intent}</span>
              </td>
              <td style="padding:9px 12px;font-size:12px;color:#64748b">${escHtml(r.suggestedAction)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function buildDfsCompetitors(dfs: DfsFullData, primary: string): string {
  const comps = dfs.competitors;
  if (!comps.length) return "";
  return `
  <div class="section">
    <div class="section-title" style="color:${primary}">⚔️ Competitor Analysis — DataForSEO</div>
    <p class="section-desc">คู่แข่งที่แย่ง keyword เดียวกัน — ข้อมูลจริงจาก DataForSEO Labs</p>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${comps.map(c => {
        const vis = c.estimatedVisibility;
        const visColor = vis >= 60 ? "#dc2626" : vis >= 30 ? "#d97706" : "#16a34a";
        return `
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
            <div style="flex:1">
              <div style="font-size:15px;font-weight:800;color:#0f172a">${escHtml(c.domain)}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">${escHtml(c.strongestContent)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:24px;font-weight:900;color:${visColor}">${vis}%</div>
              <div style="font-size:10px;color:#94a3b8">Keyword overlap</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-bottom:12px">
            <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;text-align:center">
              <div style="font-size:18px;font-weight:900;color:#16a34a">${c.sharedKeywords}</div>
              <div style="font-size:11px;color:#64748b">Shared Keywords</div>
            </div>
            <div style="flex:1;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;text-align:center">
              <div style="font-size:18px;font-weight:900;color:#dc2626">${c.missingKeywords}</div>
              <div style="font-size:11px;color:#64748b">Keywords ที่เรายังไม่มี</div>
            </div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:13px;color:#92400e">
            <strong>Action:</strong> ${escHtml(c.suggestedAction)}
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function buildDfsAiVisibility(dfs: DfsFullData, primary: string): string {
  const av = dfs.aiVisibility;
  if (!av) return "";

  const statusColor = (s: string) => s === "Low" ? "#dc2626" : s === "Medium" ? "#d97706" : "#16a34a";
  const gapColor = (g: string) => g === "High" ? "#dc2626" : g === "Medium" ? "#d97706" : "#16a34a";

  return `
  <div class="section">
    <div class="section-title" style="color:${primary}">🤖 AI Visibility Analysis</div>
    <p class="section-desc">วิเคราะห์โอกาสที่เว็บไซต์จะถูกอ้างอิงใน AI Search (ChatGPT, Gemini, Perplexity) — ข้อมูลจริงจาก DataForSEO</p>

    <!-- Status cards -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
      <div style="border:2px solid ${statusColor(av.brandMentionStatus)}40;border-radius:12px;padding:16px;text-align:center;background:${statusColor(av.brandMentionStatus)}08">
        <div style="font-size:28px;font-weight:900;color:${statusColor(av.brandMentionStatus)}">${av.brandMentionStatus}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Brand Mention ใน AI</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;background:#f8fafc">
        <div style="font-size:28px;font-weight:900;color:${primary}">${av.citationSourceGaps}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Citation Gaps</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;background:#f8fafc">
        <div style="font-size:28px;font-weight:900;color:#7c3aed">${av.promptOpportunities}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Prompt Opportunities</div>
      </div>
    </div>

    <!-- Entity score bar -->
    <div style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700;color:#0f172a">Entity Clarity Score</span>
        <span style="font-size:13px;font-weight:700;color:${scoreColor(av.entityClarityScore / 10)}">${av.entityClarityScore}/100</span>
      </div>
      <div style="background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden">
        <div style="height:100%;width:${av.entityClarityScore}%;background:${scoreColor(av.entityClarityScore / 10)};border-radius:99px"></div>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px">คะแนนความชัดเจนของ Entity ที่ AI รู้จัก — ยิ่งสูงยิ่งโดนอ้างอิงมาก</div>
    </div>

    <!-- Prompt table -->
    ${av.prompts.length > 0 ? `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">คำถามที่ User ถาม AI</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Brand</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Citation Gap</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0">Content Action</th>
          </tr>
        </thead>
        <tbody>
          ${av.prompts.map((p, i) => `
          <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"};border-bottom:1px solid #f1f5f9">
            <td style="padding:9px 12px;color:#0f172a">${escHtml(p.prompt)}</td>
            <td style="padding:9px 12px;text-align:center;font-size:14px">${p.brandAppears ? "<span style='color:#16a34a'>✓</span>" : "<span style='color:#dc2626'>✗</span>"}</td>
            <td style="padding:9px 12px;text-align:center">
              <span style="padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;
                background:${gapColor(p.citationGap)}15;color:${gapColor(p.citationGap)}">${p.citationGap}</span>
            </td>
            <td style="padding:9px 12px;font-size:12px;color:#64748b">${escHtml(p.suggestedContentAction)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  </div>`;
}

function buildCostSummary(cost: CostSummary, primary: string): string {
  return `
  <div class="section" style="background:#f8fafc">
    <div class="section-title" style="color:#64748b">💰 Scan Cost Summary</div>
    <p class="section-desc">ต้นทุนการใช้งาน AI + DataForSEO สำหรับการ scan ครั้งนี้</p>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:#fff;border:2px solid ${primary}40;border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Gemini AI (${escHtml(cost.geminiModel)})</div>
        <div style="font-size:24px;font-weight:900;color:${primary}">$${cost.geminiCostUsd.toFixed(4)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">~฿${(cost.geminiCostUsd * 34).toFixed(2)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">Input: ${cost.geminiInputTokens.toLocaleString()} · Output: ${cost.geminiOutputTokens.toLocaleString()} tokens</div>
      </div>
      <div style="background:#fff;border:2px solid #7c3aed40;border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">DataForSEO API</div>
        <div style="font-size:24px;font-weight:900;color:#7c3aed">$${cost.dfsCostUsd.toFixed(4)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">~฿${(cost.dfsCostUsd * 34).toFixed(2)}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">${cost.dfsBreakdown.length} API calls</div>
      </div>
      <div style="background:#fff;border:2px solid #16a34a40;border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">รวมทั้งหมด</div>
        <div style="font-size:28px;font-weight:900;color:#16a34a">$${cost.totalCostUsd.toFixed(4)}</div>
        <div style="font-size:13px;color:#16a34a;font-weight:700;margin-top:2px">~฿${cost.totalCostThb.toFixed(2)}</div>
      </div>
    </div>

    ${cost.dfsBreakdown.length > 0 ? `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px">
      <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">DataForSEO Breakdown</div>
      ${cost.dfsBreakdown.map(e => `
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
        <span style="color:#334155;font-family:monospace">${escHtml(e.api)}</span>
        <span style="color:#64748b;font-weight:600">$${e.costUsd.toFixed(4)}</span>
      </div>`).join("")}
    </div>` : ""}
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
  const dfs = result.dfsData;
  const cost = result.costSummary;

  // ── DataForSEO sections ──────────────────────────────────────────────────
  const dfsKeywordsSection = dfs ? buildDfsKeywords(dfs, primary) : "";
  const dfsBacklinksSection = dfs ? buildDfsBacklinks(dfs, primary) : "";
  const dfsRankingsSection = dfs ? buildDfsRankings(dfs, primary) : "";
  const dfsCompetitorsSection = dfs ? buildDfsCompetitors(dfs, primary) : "";
  const dfsAiVisibilitySection = dfs ? buildDfsAiVisibility(dfs, primary) : "";
  const costSummarySection = cost ? buildCostSummary(cost, primary) : "";

  // ── AI sections ──────────────────────────────────────────────────────────

  const aiOverview = ai ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">🤖 RankGod Senior SEO Analysis</div>
    <p class="section-desc">วิเคราะห์โดย RankGod — ผู้เชี่ยวชาญ SEO ระดับ Senior สำหรับทุกประเภทธุรกิจ</p>

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
    ${ai.salesTalkingPoints?.length > 0 ? `
    <div style="margin-top:20px">
      <div class="subsection-title" style="margin-bottom:12px">🎯 Talking Points สำหรับ Sales</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${ai.salesTalkingPoints.map((tp, i) => `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 16px;background:#fff;border:1px solid ${primary}20;border-radius:8px">
          <div style="width:24px;height:24px;border-radius:50%;background:${primary};color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${i + 1}</div>
          <div style="font-size:13px;color:#334155;line-height:1.7">${escHtml(tp)}</div>
        </div>`).join("")}
      </div>
    </div>` : ""}
    ${ai.salesInsight ? `
    <div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px">
      <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">💡 Sales Script</div>
      <p style="font-size:13px;color:#78350f;line-height:1.8">${escHtml(ai.salesInsight)}</p>
    </div>` : ""}
  </div>` : "";

  const aiExecutive = ai?.executiveSummary ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">📋 Executive Summary</div>
    <p class="section-desc">สรุปสำหรับผู้บริหารลูกค้า</p>
    <div class="exec-box">
      ${ai.websiteInsightSummary ? `<div style="font-size:13px;font-weight:700;color:${primary};margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #e2e8f0">🔍 ภาพรวมสำหรับทุกทีม</div><p class="body-text" style="margin-bottom:16px">${escHtml(ai.websiteInsightSummary)}</p>` : ""}
      <p class="body-text">${escHtml(ai.executiveSummary)}</p>
    </div>
    ${ai.competitiveEdge ? `
    <div class="subsection" style="margin-top:20px">
      <div class="subsection-title">จุดได้เปรียบ / เสียเปรียบเทียบ Competitor</div>
      <p class="body-text">${escHtml(ai.competitiveEdge)}</p>
    </div>` : ""}
  </div>` : "";

  const aiWebsiteInsight = ai?.websiteInsightSummary && !ai?.executiveSummary ? `
  <div class="section">
    <div class="section-title" style="color:${primary}">🔍 Website Insight Summary</div>
    <p class="section-desc">ภาพรวมที่ทุกทีมอ่านได้ทันที</p>
    <div class="exec-box">
      <p class="body-text">${escHtml(ai.websiteInsightSummary)}</p>
    </div>
  </div>` : "";

  const aiQuickWins = (ai != null && (ai.quickWins?.length ?? 0) > 0) ? (() => {
    const qws = ai!.quickWins;
    return `
  <div class="section">
    <div class="section-title" style="color:#16a34a">⚡ Quick Wins — ทำได้เลย ผลเร็ว</div>
    <p class="section-desc">เรียงตาม effort ต่ำ→สูง — ทำก่อน ได้ผลก่อน</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${qws.map((qw, i) => {
        const effortColor = { ต่ำ: "#16a34a", กลาง: "#d97706", สูง: "#dc2626" }[qw.effort] || "#64748b";
        const impactColor = { สูงมาก: "#7c3aed", สูง: "#0891b2", กลาง: "#d97706" }[qw.impact] || "#64748b";
        const roleColor = { SEO: "#0891b2", Content: "#059669", Dev: "#7c3aed", UX: "#ea580c", Sales: "#dc2626" }[qw.role] || "#64748b";
        return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;border-left:4px solid ${impactColor}">
        <div style="width:28px;height:28px;border-radius:8px;background:${impactColor}15;color:${impactColor};font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:6px">${escHtml(qw.task)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${roleColor}15;color:${roleColor};border:1px solid ${roleColor}30">${escHtml(qw.role)}</span>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${effortColor}15;color:${effortColor};border:1px solid ${effortColor}30">Effort: ${escHtml(qw.effort)}</span>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${impactColor}15;color:${impactColor};border:1px solid ${impactColor}30">Impact: ${escHtml(qw.impact)}</span>
            <span style="font-size:10px;color:#94a3b8;padding:2px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px">⏱ ${escHtml(qw.timeframe)}</span>
          </div>
        </div>
      </div>`;
      }).join("")}
    </div>
  </div>`;
  })() : "";

  const aiSeoOpportunity = (ai != null && (ai.seoOpportunity?.length ?? 0) > 0) ? (() => {
    const opps = ai!.seoOpportunity;
    return `
  <div class="section">
    <div class="section-title" style="color:${primary}">🚀 SEO Opportunities</div>
    <p class="section-desc">โอกาสที่เว็บนี้ยังไม่ได้ใช้ — วิเคราะห์จาก keyword และ content จริง</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${opps.map((opp, i) => `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:11px 14px;background:${i % 2 === 0 ? light : "#fff"};border:1px solid ${primary}20;border-radius:8px">
        <span style="color:${primary};font-weight:900;font-size:14px;flex-shrink:0;margin-top:1px">→</span>
        <span style="font-size:13px;color:#334155;line-height:1.7">${escHtml(opp)}</span>
      </div>`).join("")}
    </div>
  </div>`;
  })() : "";

  const aiContentOpportunity = (ai != null && (ai.contentOpportunity?.length ?? 0) > 0) ? (() => {
    const cos = ai!.contentOpportunity;
    return `
  <div class="section">
    <div class="section-title" style="color:#059669">✍️ Content Opportunities</div>
    <p class="section-desc">Content ที่ขาดหรือตอบ Search Intent ไม่ครบ — โอกาสดึง Organic Traffic</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${cos.map(co => {
        const ptColor = { blog: "#d97706", service: "#0891b2", product: "#7c3aed", landing: "#dc2626" }[co.pageType] || "#64748b";
        return `
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;border-top:3px solid ${ptColor}">
        <div style="font-size:11px;font-weight:700;color:${ptColor};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">${escHtml(co.pageType)}</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px">${escHtml(co.gap)}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px;line-height:1.6">${escHtml(co.why)}</div>
        <div style="font-size:12px;color:#334155;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 10px;line-height:1.6">💡 ${escHtml(co.suggestion)}</div>
      </div>`;
      }).join("")}
    </div>
  </div>`;
  })() : "";

  const aiUxInsights = (ai != null && (ai.uxInsights?.length ?? 0) > 0) ? (() => {
    const uxs = ai!.uxInsights;
    return `
  <div class="section">
    <div class="section-title" style="color:#ea580c">🖥️ UX/UI Insights</div>
    <p class="section-desc">จุดที่ทำให้ผู้ใช้ลังเล ไม่กด CTA หรือออกจากหน้า</p>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${uxs.map(ux => `
      <div style="border:1px solid #fed7aa;border-radius:10px;background:#fff7ed;padding:16px 18px">
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
          <span style="font-size:16px;flex-shrink:0">⚠️</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#9a3412;margin-bottom:2px">${escHtml(ux.issue)}</div>
            <div style="font-size:11px;color:#c2410c">${escHtml(ux.location)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:6px;padding:10px 12px">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">ผลกระทบ</div>
            <div style="font-size:12px;color:#334155;line-height:1.6">${escHtml(ux.impact)}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 12px">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px">วิธีแก้</div>
            <div style="font-size:12px;color:#166534;line-height:1.6">${escHtml(ux.fix)}</div>
          </div>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
  })() : "";

  const aiBusinessInsights = (ai != null && (ai.businessInsights?.length ?? 0) > 0) ? (() => {
    const bis = ai!.businessInsights;
    return `
  <div class="section">
    <div class="section-title" style="color:#7c3aed">💼 Business Insights</div>
    <p class="section-desc">โอกาสทางธุรกิจจากการวิเคราะห์เว็บ — สำหรับ Owner, CMO, CEO</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
      ${bis.map((bi, i) => `
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#7c3aed10,#a78bfa10);border-bottom:2px solid #7c3aed20;padding:14px 16px">
          <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">โอกาส #${i + 1}</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a">${escHtml(bi.opportunity)}</div>
        </div>
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
          <div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:3px">สถานการณ์ปัจจุบัน</div>
            <div style="font-size:12px;color:#64748b;line-height:1.6">${escHtml(bi.currentState)}</div>
          </div>
          <div style="background:#f0fdf4;border-radius:6px;padding:10px 12px">
            <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;margin-bottom:3px">ผลลัพธ์ที่คาดได้</div>
            <div style="font-size:12px;color:#166534;line-height:1.6">${escHtml(bi.potentialImpact)}</div>
          </div>
          <div style="background:#fffbeb;border-radius:6px;padding:10px 12px">
            <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;margin-bottom:3px">การลงทุน</div>
            <div style="font-size:12px;color:#92400e;line-height:1.6">${escHtml(bi.investment)}</div>
          </div>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
  })() : "";

  const aiRoleInsights = (ai != null && (ai.roleInsights?.length ?? 0) > 0) ? (() => {
    const ris = ai!.roleInsights;
    return `
  <div class="section">
    <div class="section-title" style="color:#0891b2">👥 Insights แยกตามทีม</div>
    <p class="section-desc">แต่ละทีมอ่าน section ของตัวเองได้เลย — ไม่ต้องอ่านทั้งหมด</p>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${ris.map(ri => {
        const prioColor = { ด่วน: "#dc2626", สำคัญ: "#ea580c", ทำเพิ่ม: "#64748b" }[ri.priority] || "#64748b";
        const roleIcon: Record<string, string> = { Sales: "💰", SEO: "🔍", Content: "✍️", "UX/Creative": "🎨", "Manager/CMO": "📊", "CEO/Owner": "🏆" };
        return `
      <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
          <span style="font-size:18px">${roleIcon[ri.role] || "👤"}</span>
          <div style="flex:1">
            <span style="font-size:14px;font-weight:700;color:#0f172a">${escHtml(ri.role)}</span>
          </div>
          <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;background:${prioColor}15;color:${prioColor};border:1px solid ${prioColor}30">${escHtml(ri.priority)}</span>
        </div>
        <div style="padding:14px 16px">
          <p style="font-size:13px;color:#334155;line-height:1.7;margin-bottom:10px">${escHtml(ri.insight)}</p>
          ${ri.actions?.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:5px">
            ${ri.actions.map(a => `
            <div style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#475569">
              <span style="color:${prioColor};font-weight:900;flex-shrink:0">▸</span>
              <span style="line-height:1.6">${escHtml(a)}</span>
            </div>`).join("")}
          </div>` : ""}
        </div>
      </div>`;
      }).join("")}
    </div>
  </div>`;
  })() : "";

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

  type SmGroup = { label: string; icon: string; color: string; urls: string[]; desc: string };
  const smGroups: SmGroup[] = [
    { label: "หน้าหลัก", icon: "🏠", color: primary, urls: ["/"], desc: "Homepage — จุดเริ่มต้นของทุก crawl path" },
    ...(sr.collections.length > 0 ? [{ label: "Collections / Categories", icon: "📂", color: "#7c3aed", urls: sr.collections.slice(0, 10), desc: "หน้าหมวดหมู่สินค้าหรือบริการ — ช่วย internal linking และ crawl budget" }] : []),
    ...(sr.products ? [{ label: "Products / Services", icon: "📦", color: "#0891b2", urls: [sr.products], desc: "หน้าสินค้าหรือบริการ — target transactional keyword" }] : []),
    ...(sr.pages.length > 0 ? [{ label: "Static Pages", icon: "📄", color: "#059669", urls: sr.pages.slice(0, 8), desc: "หน้าคงที่ เช่น About, Contact, FAQ — สร้างความน่าเชื่อถือ" }] : []),
    ...(sr.blogs.length > 0 ? [{ label: "Blog / Content", icon: "✍️", color: "#d97706", urls: sr.blogs.slice(0, 6), desc: "หน้าบทความ — target informational keyword และดึง organic traffic" }] : []),
    ...(sr.other.length > 0 ? [{ label: "Other Pages", icon: "🔗", color: "#64748b", urls: sr.other.slice(0, 5), desc: "หน้าเสริมที่ควรอยู่ใน sitemap.xml" }] : []),
  ];

  const totalSmUrls = smGroups.reduce((n, g) => n + g.urls.length, 0);

  const sitemapSection = `
  <div class="section">
    <div class="section-title" style="color:${primary}">🗺️ Sitemap Architecture ที่แนะนำ</div>
    <p class="section-desc">โครงสร้างเว็บระดับมืออาชีพที่แนะนำให้ submit ใน Google Search Console — ${totalSmUrls} URL จัดกลุ่มตาม page type</p>

    <!-- Summary bar -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
      ${smGroups.map(g => `
      <div style="display:flex;align-items:center;gap:6px;background:${g.color}10;border:1px solid ${g.color}30;border-radius:8px;padding:7px 14px">
        <span style="font-size:14px">${g.icon}</span>
        <div>
          <div style="font-size:11px;font-weight:700;color:${g.color}">${g.label}</div>
          <div style="font-size:11px;color:#94a3b8">${g.urls.length} URL</div>
        </div>
      </div>`).join("")}
    </div>

    <!-- Architecture tree -->
    <div style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">

      <!-- Root -->
      <div style="background:${primary};color:#fff;padding:14px 20px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🌐</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:800;letter-spacing:0.02em">${escHtml(domain)}</div>
          <div style="font-size:11px;opacity:0.7;margin-top:1px">Root Domain · ${result.isHttps ? "HTTPS ✓" : "HTTP ✗"}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:900">${totalSmUrls}</div>
          <div style="font-size:10px;opacity:0.7">total URLs</div>
        </div>
      </div>

      <!-- Groups -->
      <div style="padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:10px">
        ${smGroups.filter(g => g.urls[0] !== "/").map(g => `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">

          <!-- Group header -->
          <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #f1f5f9;background:${g.color}06">
            <div style="width:32px;height:32px;border-radius:8px;background:${g.color}15;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${g.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;color:#0f172a">${g.label}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:1px">${g.desc}</div>
            </div>
            <div style="background:${g.color}20;color:${g.color};border:1px solid ${g.color}40;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;flex-shrink:0">${g.urls.length} URLs</div>
          </div>

          <!-- URLs -->
          <div style="padding:10px 14px;display:flex;flex-direction:column;gap:4px">
            ${g.urls.map((url, ui) => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:${ui % 2 === 0 ? "#f8fafc" : "#fff"};border:1px solid #f1f5f9">
              <div style="width:18px;height:18px;border-radius:4px;background:${g.color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <div style="width:5px;height:5px;border-radius:50%;background:${g.color}"></div>
              </div>
              <code style="font-size:12px;color:#334155;font-family:monospace;word-break:break-all;flex:1">${escHtml(url)}</code>
              <span style="font-size:10px;color:#94a3b8;flex-shrink:0;font-weight:600">Priority ${ui === 0 ? "1.0" : ui < 3 ? "0.8" : "0.6"}</span>
            </div>`).join("")}
          </div>
        </div>`).join("")}
      </div>
    </div>

    <!-- Instruction -->
    <div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:16px;flex-shrink:0">💡</span>
      <div style="font-size:13px;color:#92400e;line-height:1.7">
        <strong>วิธีดำเนินการ:</strong> สร้างไฟล์ <code style="background:#fef3c7;padding:1px 5px;border-radius:3px">sitemap.xml</code> ครอบคลุม URL ทั้งหมดข้างต้น
        ตั้ง <code style="background:#fef3c7;padding:1px 5px;border-radius:3px">changefreq</code> และ <code style="background:#fef3c7;padding:1px 5px;border-radius:3px">priority</code> ตามที่แสดง
        แล้ว Submit ผ่าน Google Search Console → Sitemaps
      </div>
    </div>
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
.lp-card { border:1px solid #e2e8f0; border-radius:10px; padding:16px; overflow:hidden; min-width:0; }
.lp-url { font-size:11px; color:#94a3b8; word-break:break-all; overflow-wrap:break-word; margin-bottom:4px; max-width:100%; }
.lp-topic { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:4px; word-break:break-word; }
.lp-strength { font-size:12px; color:#64748b; line-height:1.6; margin-bottom:8px; word-break:break-word; }
.lp-keywords { display:flex; flex-wrap:wrap; gap:4px; }
.kw-chip { font-size:10px; background:${light}; color:${primary}; border:1px solid ${primary}20; border-radius:4px; padding:2px 7px; word-break:break-word; }
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

  <div class="cover-date" style="margin-top:28px">จัดทำเมื่อ ${date} &nbsp;·&nbsp; วิเคราะห์โดย RankGod</div>
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

<!-- ══ SALES PITCH + TALKING POINTS ═════════════════════════════════════ -->
${aiSalesPitch}

<!-- ══ QUICK WINS ════════════════════════════════════════════════════════ -->
${aiQuickWins}

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

<!-- ══ DFS KEYWORD INTELLIGENCE ══════════════════════════════════════════ -->
${dfsKeywordsSection}

<!-- ══ DFS RANK TRACKING ═════════════════════════════════════════════════ -->
${dfsRankingsSection}

<!-- ══ AI COMPETITORS (AI) ════════════════════════════════════════════════ -->
${aiCompetitors}

<!-- ══ DFS COMPETITOR ANALYSIS ══════════════════════════════════════════ -->
${dfsCompetitorsSection}

<!-- ══ DFS BACKLINK INTELLIGENCE ════════════════════════════════════════ -->
${dfsBacklinksSection}

<!-- ══ AI VISIBILITY ═════════════════════════════════════════════════════ -->
${dfsAiVisibilitySection}

<!-- ══ DETAILED SITEMAP ═══════════════════════════════════════════════════ -->
${aiDetailedSitemap}

<!-- ══ AI TEAM ACTIONS ════════════════════════════════════════════════════ -->
${aiTeamActions}

<!-- ══ AI ACTION PLAN ═════════════════════════════════════════════════════ -->
${aiActionPlan}

<!-- ══ EXPECTED RESULTS ══════════════════════════════════════════════════ -->
${aiExpected}

<!-- ══ SEO OPPORTUNITIES ═════════════════════════════════════════════════ -->
${aiSeoOpportunity}

<!-- ══ CONTENT OPPORTUNITIES ════════════════════════════════════════════ -->
${aiContentOpportunity}

<!-- ══ UX INSIGHTS ══════════════════════════════════════════════════════ -->
${aiUxInsights}

<!-- ══ BUSINESS INSIGHTS ════════════════════════════════════════════════ -->
${aiBusinessInsights}

<!-- ══ ROLE INSIGHTS ════════════════════════════════════════════════════ -->
${aiRoleInsights}

<!-- ══ EXECUTIVE SUMMARY ═════════════════════════════════════════════════ -->
${aiExecutive}
${aiWebsiteInsight}

<!-- ══ SITEMAP RECOMMENDED ══════════════════════════════════════════════ -->
${sitemapSection}

<!-- ══ PAGES ══════════════════════════════════════════════════════════════ -->
${pagesSection}

<!-- ══ FOOTER ═════════════════════════════════════════════════════════════ -->
<div style="background:#0f172a;color:#475569;padding:28px 64px;font-size:12px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:4px">RankGod SEO Intelligence</div>
    <div>วิเคราะห์โดย RankGod · ข้อมูลจริงจาก ${result.pageCount} หน้า · DataForSEO + Gemini AI</div>
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
