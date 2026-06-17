/**
 * Claude Senior SEO Analyst — takes CrawlData + scorer output → full Thai SEO report
 */
import Anthropic from "@anthropic-ai/sdk";
import type { CrawlData } from "./crawler";
import type { ScorerResult } from "./scorer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LandingPage {
  url: string;
  topic: string;
  strength: string;
  keywords: string[];
  wordCount: number;
}

export interface KeywordSignal {
  keyword: string;
  foundIn: string;
  potential: "สูงมาก" | "สูง" | "กลาง" | "ต่ำ";
  searchIntent: string;
}

export interface TeamAction {
  role: string;
  timeframe: string;
  actions: string[];
  priority: "ด่วน" | "สำคัญ" | "ทำเพิ่ม";
}

export interface ActionPhase {
  phase: number;
  name: string;
  duration: string;
  focus: string;
  tasks: string[];
  expectedImpact: string;
}

export interface ExpectedResults {
  day30: string[];
  day60: string[];
  day90: string[];
}

export interface KeywordSuggestion {
  group: string;
  keywords: string[];
  searchIntent: "informational" | "transactional" | "commercial" | "navigational";
  priority: "สูงมาก" | "สูง" | "กลาง";
  reason: string;
  suggestedPage: string;
}

export interface Competitor {
  name: string;
  domain: string;
  whyFocus: string;
  theirStrengths: string[];
  gaps: string[];
}

export interface SitemapPage {
  slug: string;
  title: string;
  pageType: string;
  targetKeywords: string[];
  priority: "high" | "medium" | "low";
  note: string;
}

export interface SitemapSection {
  section: string;
  icon: string;
  pages: SitemapPage[];
}

export interface IssueInsight {
  id: string;
  impact: string[];
  fix: string[];
}

export interface AiSeoAnalysis {
  overallVerdict: string;
  businessType: string;
  targetAudience: string;
  currentSeoMaturity: "เริ่มต้น" | "พัฒนา" | "ดี" | "ยอดเยี่ยม";
  siteStructureAnalysis: string;
  landingPages: LandingPage[];
  keywordSignals: KeywordSignal[];
  keywordSuggestions: KeywordSuggestion[];
  competitors: Competitor[];
  detailedSitemap: SitemapSection[];
  whatIsWorking: string[];
  contentGaps: string[];
  competitiveEdge: string;
  teamActions: TeamAction[];
  actionPlan: ActionPhase[];
  expectedResults: ExpectedResults;
  salesPitchSummary: string;
  executiveSummary: string;
  issueInsights: IssueInsight[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContextSummary(data: CrawlData, scorer: ScorerResult): string {
  const pages = data.pages.filter(p => p.status === 200);
  const s = scorer.scores;

  const topPages = pages
    .sort((a, b) => b.wordCount - a.wordCount)
    .slice(0, 10)
    .map(p => ({
      url: p.url,
      type: p.pageType,
      title: p.title || "(ไม่มี title)",
      h1: p.h1 || "(ไม่มี h1)",
      meta: p.metaDescription ? p.metaDescription.slice(0, 100) : "(ไม่มี meta)",
      words: p.wordCount,
      schemas: p.schemas,
      internalLinks: p.internalLinks.length,
      missingAlt: p.missingAltCount,
      hasFaq: p.hasFaq,
      hasContact: p.hasContactInfo,
      hasOrg: p.hasOrganizationSchema,
      hasProduct: p.hasProductSchema,
      hasBreadcrumb: p.hasBreadcrumbSchema,
    }));

  const criticalTitles = scorer.issues.critical.map(i => i.title).join("; ");
  const highTitles = scorer.issues.high.map(i => i.title).join("; ");
  const allIssues = [
    ...scorer.issues.critical.map(i => ({ id: i.id, title: i.title, priority: "critical" })),
    ...scorer.issues.high.map(i => ({ id: i.id, title: i.title, priority: "high" })),
    ...scorer.issues.medium.map(i => ({ id: i.id, title: i.title, priority: "medium" })),
  ];

  const navStr = data.navRawItems.slice(0, 20).join(", ");

  return JSON.stringify({
    domain: data.domain,
    isHttps: data.isHttps,
    languages: data.languages,
    isMultiLanguage: data.isMultiLanguage,
    pages_crawled: pages.length,
    all_discovered_urls: data.allDiscoveredUrls.length,
    sitemap: { found: data.sitemap.found, urlCount: data.sitemap.urlCount, url: data.sitemap.url },
    robots: { found: data.robots.found, disallowedPaths: data.robots.disallowedPaths },
    scores: s,
    nav_items_raw: navStr,
    top_pages: topPages,
    critical_issues: criticalTitles,
    high_issues: highTitles,
    all_issues: allIssues,
    page_type_counts: {
      home: pages.filter(p => p.pageType === "home").length,
      product: pages.filter(p => p.pageType === "product").length,
      collection: pages.filter(p => p.pageType === "collection").length,
      blog: pages.filter(p => p.pageType === "blog").length,
      faq: pages.filter(p => p.pageType === "faq").length,
      about: pages.filter(p => p.pageType === "about").length,
      contact: pages.filter(p => p.pageType === "contact").length,
      policy: pages.filter(p => p.pageType === "policy").length,
      other: pages.filter(p => p.pageType === "other").length,
    },
    brand_colors: data.pages[0]?.brandColors?.slice(0, 5) || [],
  }, null, 0);
}

function extractJsonBlock(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

function fixControlChars(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === "\\") { out += c; escaped = true; continue; }
    if (c === '"') inString = !inString;
    if (inString && (c === "\n" || c === "\r" || c === "\t")) {
      out += c === "\n" ? "\\n" : c === "\r" ? "\\r" : "\\t";
    } else {
      out += c;
    }
  }
  return out;
}

function safeParseJson<T>(text: string): T | null {
  const raw = extractJsonBlock(text);
  const fixed = fixControlChars(raw);
  try {
    return JSON.parse(fixed) as T;
  } catch {
    // Attempt to close truncated JSON
    let closed = fixed;
    const opens = (closed.match(/\[/g) || []).length - (closed.match(/\]/g) || []).length;
    const openBraces = (closed.match(/\{/g) || []).length - (closed.match(/\}/g) || []).length;
    for (let i = 0; i < opens; i++) closed += "]";
    for (let i = 0; i < openBraces; i++) closed += "}";
    try { return JSON.parse(closed) as T; } catch { return null; }
  }
}

// ─── Claude prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `คุณคือ Senior SEO Consultant ระดับโลก มีประสบการณ์ 15 ปีในการทำ SEO ให้เว็บไซต์ทุกประเภท ทั้ง E-commerce, B2B, Service, Local Business, SaaS

**ภารกิจ**: วิเคราะห์ข้อมูล SEO ที่ scan มาจากเว็บไซต์จริง แล้วสร้าง รายงาน SEO เชิงลึก ภาษาไทย สำหรับ Sales Team นำไปเสนอลูกค้า

**สิ่งที่ต้องทำ**:
1. อ่านข้อมูลเว็บอย่างละเอียด — ดูทุก page, title, H1, meta, schema, structure
2. วิเคราะห์ธุรกิจ — เว็บนี้ทำธุรกิจอะไร, กลุ่มเป้าหมายคือใคร
3. ระบุ Landing Pages สำคัญ — หน้าไหนมีโอกาส rank ได้บ้าง
4. หา Keyword Signals — keyword อะไรที่เห็นในเว็บนี้ มีศักยภาพแค่ไหน
5. สร้าง Action Plan 4 Phase — timeline ชัดเจน งานจริง ผลลัพธ์จริง
6. สรุป Sales Pitch — ทีม Sales เอาไปพูดกับลูกค้าได้เลย

**สิ่งที่ห้าม**:
- ห้ามแต่งข้อมูลขึ้นมาเอง — ใช้แค่ข้อมูลที่ scan มา
- ห้ามพูดกว้างๆ — ต้องอ้างอิง URL จริง, title จริง, ปัญหาจริง
- ห้ามใช้ภาษาอังกฤษโดยไม่จำเป็น — ใช้ภาษาไทยทั้งหมด ยกเว้นคำศัพท์เทคนิค SEO

**Output format**: JSON ตามโครงสร้างที่กำหนด`;

// ─── Main function ────────────────────────────────────────────────────────────

export async function runAiAnalysis(
  data: CrawlData,
  scorer: ScorerResult
): Promise<AiSeoAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const contextSummary = buildContextSummary(data, scorer);
  const pages = data.pages.filter(p => p.status === 200);
  const topPageUrls = pages.slice(0, 8).map(p => p.url).join(", ");
  const allIssuesList = [
    ...scorer.issues.critical.map(i => ({ id: i.id, title: i.title })),
    ...scorer.issues.high.map(i => ({ id: i.id, title: i.title })),
    ...scorer.issues.medium.map(i => ({ id: i.id, title: i.title })),
  ];
  const issueInsightsTemplate = allIssuesList.map(issue =>
    `{"id":"${issue.id}","impact":["ผลกระทบเฉพาะของ '${issue.title}' ต่อธุรกิจ ${data.domain}"],"fix":["วิธีแก้เฉพาะเจาะจงสำหรับเว็บนี้ ไม่ใช่ generic"]}`
  ).join(",\n    ");

  const userPrompt = `วิเคราะห์เว็บไซต์: ${data.domain}

ข้อมูลที่ scan มาจากเว็บจริง:
${contextSummary}

ตอบเป็น JSON object เดียว ไม่มี markdown ไม่มี comment เริ่มด้วย { จบด้วย }
Field ต้องครบทุกตัว ห้ามข้าม ใช้ข้อมูลจริงจาก scan เท่านั้น:

{
  "businessType": "ประเภทธุรกิจจาก content จริง",
  "targetAudience": "กลุ่มเป้าหมายจาก content จริง",
  "currentSeoMaturity": "เริ่มต้น|พัฒนา|ดี|ยอดเยี่ยม",
  "overallVerdict": "สรุป SEO 2-3 ประโยค จากข้อมูลจริง",
  "salesPitchSummary": "3-4 ประโยคสำหรับ Sales Team — ปัญหาหลักของเว็บนี้คืออะไร เราช่วยอะไรได้ ผลลัพธ์ที่จะได้รับ",
  "executiveSummary": "4-5 ประโยคสำหรับผู้บริหาร — สถานการณ์ปัจจุบัน โอกาสที่พลาด สิ่งที่ต้องทำ ROI ที่คาดหวัง",
  "actionPlan": [
    {"phase":1,"name":"ชื่อ Phase","duration":"Week 1-2","focus":"โฟกัส","tasks":["งานจริงอ้างอิงปัญหาในเว็บนี้"],"expectedImpact":"ผลลัพธ์"},
    {"phase":2,"name":"ชื่อ Phase","duration":"Month 1","focus":"โฟกัส","tasks":["งานจริง"],"expectedImpact":"ผลลัพธ์"},
    {"phase":3,"name":"ชื่อ Phase","duration":"Month 2","focus":"โฟกัส","tasks":["งานจริง"],"expectedImpact":"ผลลัพธ์"},
    {"phase":4,"name":"ชื่อ Phase","duration":"Month 3","focus":"โฟกัส","tasks":["งานจริง"],"expectedImpact":"ผลลัพธ์"}
  ],
  "expectedResults": {
    "day30": ["ผล 30 วัน จริง ไม่โอ้อวด", "ผล 30 วัน ข้อ 2"],
    "day60": ["ผล 60 วัน จริง", "ผล 60 วัน ข้อ 2"],
    "day90": ["ผล 90 วัน จริง", "ผล 90 วัน ข้อ 2"]
  },
  "siteStructureAnalysis": "วิเคราะห์ structure จริง",
  "competitiveEdge": "จุดได้เปรียบ/เสียเปรียบจริง",
  "whatIsWorking": ["สิ่งดีจริงจากข้อมูล"],
  "contentGaps": ["Content ที่ขาดจริง"],
  "landingPages": [
    {"url":"URL จริงจาก ${topPageUrls || data.baseUrl}","topic":"topic","strength":"จุดแข็ง","keywords":["kw1","kw2"],"wordCount":0}
  ],
  "keywordSignals": [
    {"keyword":"keyword จากเว็บจริง","foundIn":"title/h1/url","potential":"สูงมาก|สูง|กลาง|ต่ำ","searchIntent":"transactional"}
  ],
  "keywordSuggestions": [
    {"group":"ชื่อกลุ่ม keyword","keywords":["kw หลัก","kw รอง","long-tail"],"searchIntent":"transactional","priority":"สูงมาก|สูง|กลาง","reason":"เหตุผลจากธุรกิจจริง","suggestedPage":"/slug"},
    {"group":"กลุ่มที่ 2","keywords":["kw1","kw2","kw3"],"searchIntent":"commercial","priority":"สูง","reason":"เหตุผล","suggestedPage":"/slug2"},
    {"group":"กลุ่มที่ 3","keywords":["kw1","kw2","kw3"],"searchIntent":"informational","priority":"กลาง","reason":"เหตุผล","suggestedPage":"/slug3"},
    {"group":"กลุ่มที่ 4","keywords":["kw1","kw2","kw3"],"searchIntent":"transactional","priority":"สูงมาก","reason":"เหตุผล","suggestedPage":"/slug4"},
    {"group":"กลุ่มที่ 5","keywords":["kw1","kw2","kw3"],"searchIntent":"commercial","priority":"สูง","reason":"เหตุผล","suggestedPage":"/slug5"}
  ],
  "competitors": [
    {"name":"competitor จริง","domain":"domain.com","whyFocus":"เหตุผล","theirStrengths":["จุดแข็ง"],"gaps":["ช่องว่าง"]},
    {"name":"competitor 2","domain":"domain2.com","whyFocus":"เหตุผล","theirStrengths":["จุดแข็ง"],"gaps":["ช่องว่าง"]},
    {"name":"competitor 3","domain":"domain3.com","whyFocus":"เหตุผล","theirStrengths":["จุดแข็ง"],"gaps":["ช่องว่าง"]}
  ],
  "detailedSitemap": [
    {"section":"หมวดหลัก","icon":"📦","pages":[
      {"slug":"/page","title":"ชื่อหน้า","pageType":"product","targetKeywords":["kw1"],"priority":"high","note":"มีอยู่แล้ว|ต้องปรับ|ต้องสร้างใหม่"}
    ]}
  ],
  "teamActions": [
    {"role":"SEO Specialist","timeframe":"Week 1-2","actions":["งานจริง"],"priority":"ด่วน"},
    {"role":"Web Developer","timeframe":"Month 1","actions":["งานจริง"],"priority":"สำคัญ"},
    {"role":"Content Writer","timeframe":"Month 2","actions":["งานจริง"],"priority":"ทำเพิ่ม"}
  ],
  "issueInsights": [
    ${issueInsightsTemplate}
  ]
}`;

  const isOverloadedError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const e = err as Record<string, unknown>;
    if (typeof e.type === "string" && e.type === "overloaded_error") return true;
    if (e.error && typeof e.error === "object") {
      const inner = e.error as Record<string, unknown>;
      if (inner.type === "overloaded_error") return true;
    }
    try { return JSON.stringify(err).includes("overloaded"); } catch { return false; }
  };

  // Model fallback order: try opus first, fall back to sonnet if overloaded
  const MODEL_SEQUENCE = [
    process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-opus-4-8",
  ];

  const attemptCall = async (model: string) => {
    console.log(`[aiAnalyzer] Calling model: ${model}`);
    const stream = await client.messages.stream({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    return stream.finalMessage();
  };

  try {
    let message;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MODEL_SEQUENCE.length; attempt++) {
      const model = MODEL_SEQUENCE[attempt];
      try {
        message = await attemptCall(model);
        console.log(`[aiAnalyzer] Success with model: ${model}`);
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (isOverloadedError(err) && attempt < MODEL_SEQUENCE.length - 1) {
          const wait = 8000;
          console.log(`[aiAnalyzer] ${model} overloaded (attempt ${attempt + 1}/${MODEL_SEQUENCE.length}), switching model in ${wait/1000}s...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          console.error(`[aiAnalyzer] Failed with model ${model}:`, String(err).slice(0, 100));
          throw err;
        }
      }
    }
    if (!message) throw lastErr;
    const textBlock = message.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = safeParseJson<AiSeoAnalysis>(textBlock.text);
    if (!parsed) return null;

    // Hard validation — reject entirely if core real-data fields are missing
    // No fabricated fallbacks allowed: every field must come from Claude's analysis of actual site data
    const missing: string[] = [];
    if (!parsed.salesPitchSummary?.trim())   missing.push("salesPitchSummary");
    if (!parsed.executiveSummary?.trim())    missing.push("executiveSummary");
    if (!parsed.businessType?.trim())        missing.push("businessType");
    if (!parsed.overallVerdict?.trim())      missing.push("overallVerdict");
    if (!parsed.actionPlan?.length)          missing.push("actionPlan");
    if (!parsed.expectedResults?.day30?.length) missing.push("expectedResults.day30");
    if (!parsed.expectedResults?.day60?.length) missing.push("expectedResults.day60");
    if (!parsed.expectedResults?.day90?.length) missing.push("expectedResults.day90");
    if (missing.length > 0) {
      console.error("[aiAnalyzer] Missing fields:", missing.join(", "));
      console.error("[aiAnalyzer] Keys present:", Object.keys(parsed).join(", "));
      return null;
    }

    // Safe array defaults only — these are collection fields that may legitimately be empty
    if (!parsed.whatIsWorking)      parsed.whatIsWorking = [];
    if (!parsed.contentGaps)        parsed.contentGaps = [];
    if (!parsed.landingPages)       parsed.landingPages = [];
    if (!parsed.keywordSignals)     parsed.keywordSignals = [];
    if (!parsed.keywordSuggestions) parsed.keywordSuggestions = [];
    if (!parsed.competitors)        parsed.competitors = [];
    if (!parsed.detailedSitemap)    parsed.detailedSitemap = [];
    if (!parsed.teamActions)        parsed.teamActions = [];
    if (!parsed.issueInsights)      parsed.issueInsights = [];

    return parsed;
  } catch (err) {
    console.error("[aiAnalyzer] Claude error:", err);
    return null;
  }
}
