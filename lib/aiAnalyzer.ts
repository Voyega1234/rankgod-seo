/**
 * Gemini Senior SEO Analyst — takes CrawlData + scorer output → full Thai SEO report
 * Optionally enriched with Vertex AI Grounding (Google Search) for competitor/keyword intelligence
 */
import { runGroundingResearch } from "./groundingResearch";
import { generateGeminiText, hasGeminiApiKey, readGeminiUsage } from "./geminiApi";
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

// ─── Multi-role Insight Types ─────────────────────────────────────────────────

export interface RoleInsight {
  role: string;
  priority: "ด่วน" | "สำคัญ" | "ทำเพิ่ม";
  insight: string;
  actions: string[];
}

export interface ContentInsight {
  gap: string;
  why: string;
  suggestion: string;
  pageType: string;
}

export interface UxInsight {
  issue: string;
  impact: string;
  fix: string;
  location: string;
}

export interface BusinessInsight {
  opportunity: string;
  currentState: string;
  potentialImpact: string;
  investment: string;
}

export interface QuickWin {
  task: string;
  role: string;
  effort: "ต่ำ" | "กลาง" | "สูง";
  impact: "สูงมาก" | "สูง" | "กลาง";
  timeframe: string;
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

  // ── Multi-role Insight (ใหม่) ──────────────────────────────────────────────
  websiteInsightSummary: string;        // ภาพรวมที่ทุกทีมอ่านได้
  seoOpportunity: string[];             // SEO Expert + Senior SEO
  contentOpportunity: ContentInsight[]; // Content Writer + Keyword Researcher
  uxInsights: UxInsight[];              // UX/UI Expert + Creative Expert
  salesInsight: string;                 // Sales talking point พร้อมใช้
  salesTalkingPoints: string[];         // bullet สำหรับ Sales team
  businessInsights: BusinessInsight[];  // Owner + CMO + CEO
  quickWins: QuickWin[];               // Action plan แยก effort/impact
  roleInsights: RoleInsight[];          // insight แยกตาม role/ทีม
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Stop words ครอบคลุมทุกภาษาที่เว็บไทยมักใช้
const STOPWORDS = new Set([
  // English
  "the","and","for","are","was","with","this","that","from","have","has","not","but","can","will",
  "your","all","one","more","page","home","our","you","how","get","use","new","its","their","been",
  "also","into","than","then","when","what","who","which","where","why","about","after","before",
  // Thai
  "ไม่","และ","ของ","ที่","ใน","มี","กับ","การ","เป็น","ได้","ให้","คือ","จาก","ใช้","หรือ","แบบ",
  "เว็บ","ๆ","ด้วย","โดย","แต่","ก็","ยัง","จะ","นั้น","นี้","อยู่","มาก","น้อย","ทุก","บาง","เพื่อ",
  "ถ้า","เมื่อ","แล้ว","อีก","ทำ","บน","ล่าง","ผ่าน","ตาม","ระหว่าง","ก่อน","หลัง","ใต้","เหนือ",
  // Japanese (common particles/function words)
  "の","に","は","を","が","で","と","も","な","へ","や","か","から","まで","より","だ","です","ます",
  // Chinese (common function words)
  "的","了","在","是","我","有","和","就","不","人","都","一","个","上","他","也","她",
  // Korean (common particles)
  "이","가","은","는","을","를","의","에","로","으로","와","과","도","만","에서","하다","있다",
  // Spanish / Portuguese
  "los","las","una","unos","para","con","que","por","del","como","más","pero","sin","sobre","entre",
  "os","as","um","uma","para","com","que","por","do","da","como","mais","mas","sem","sobre",
  // French
  "les","des","une","pour","avec","que","par","sur","dans","mais","ou","si","car","aussi",
  // German
  "die","der","das","und","ist","ein","eine","für","mit","auf","von","zu","im","als","auch",
]);

/** Detect script type of text to handle CJK languages without spaces */
function detectScript(text: string): "cjk" | "latin" {
  const cjkRatio = (text.match(/[　-鿿가-힯豈-﫿]/g) || []).length / Math.max(text.length, 1);
  return cjkRatio > 0.2 ? "cjk" : "latin";
}

/** Extract meaningful keyword tokens — handles both space-separated and CJK scripts */
function extractTokens(text: string | null): string[] {
  if (!text) return [];
  const cleaned = text.toLowerCase().replace(/[|–\-:,()[\]「」【】《》『』、。！？·•]/g, " ");

  if (detectScript(text) === "cjk") {
    // CJK: extract n-grams of 2-4 chars as "words"
    const cjkTokens: string[] = [];
    const segments = cleaned.split(/\s+/).filter(Boolean);
    for (const seg of segments) {
      // 2-char ngrams
      for (let i = 0; i <= seg.length - 2; i++) cjkTokens.push(seg.slice(i, i + 2));
      // 3-char ngrams
      for (let i = 0; i <= seg.length - 3; i++) cjkTokens.push(seg.slice(i, i + 3));
    }
    return cjkTokens.filter(t => t.length >= 2);
  }

  return cleaned
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

/** Extract bigram phrases from space-separated text (skip CJK — ngrams already handle it) */
function extractBigrams(text: string | null): string[] {
  if (!text) return [];
  if (detectScript(text) === "cjk") return [];
  const words = text
    .toLowerCase()
    .replace(/[|–\-:,()[\]]/g, " ")
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

/** Deduplicate and rank keywords by frequency across all pages — multilingual, includes bigrams */
export function buildKeywordFrequencyMap(pages: import("./crawler").PageData[]): { keyword: string; count: number; foundIn: string[] }[] {
  const freq: Record<string, { count: number; sources: Set<string> }> = {};

  const addToFreq = (tokens: string[], pageType: string) => {
    const seen = new Set<string>();
    for (const tok of tokens) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      if (!freq[tok]) freq[tok] = { count: 0, sources: new Set() };
      freq[tok].count++;
      freq[tok].sources.add(pageType);
    }
  };

  for (const p of pages) {
    addToFreq([
      ...extractTokens(p.title),
      ...extractTokens(p.h1),
      ...extractTokens(p.metaDescription),
      ...(p.h2s || []).flatMap(h => extractTokens(h)),
    ], p.pageType);

    addToFreq([
      ...extractBigrams(p.title),
      ...extractBigrams(p.h1),
      ...(p.h2s || []).flatMap(h => extractBigrams(h)),
    ], p.pageType);
  }

  return Object.entries(freq)
    .filter(([kw, v]) => {
      if (v.count < 2) return false;
      const parts = kw.split(" ");
      if (parts.length === 1 && STOPWORDS.has(kw)) return false;
      return true;
    })
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 120)
    .map(([kw, v]) => ({ keyword: kw, count: v.count, foundIn: [...v.sources] }));
}

/** Detect URL structure patterns (e.g. /blog/, /products/, /th-TH/) */
function buildUrlPatterns(urls: string[]): { pattern: string; count: number; example: string }[] {
  const patternMap: Record<string, { count: number; example: string }> = {};
  for (const u of urls) {
    try {
      const path = new URL(u).pathname;
      const segments = path.split("/").filter(Boolean);
      if (segments.length === 0) continue;
      // Use first 2 path segments as pattern
      const pattern = "/" + segments.slice(0, Math.min(2, segments.length - 1)).join("/") + (segments.length > 1 ? "/..." : "");
      if (!patternMap[pattern]) patternMap[pattern] = { count: 0, example: u };
      patternMap[pattern].count++;
    } catch { /* skip invalid */ }
  }
  return Object.entries(patternMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)
    .map(([pattern, v]) => ({ pattern, count: v.count, example: v.example }));
}

/** Detect potential keyword cannibalization — titles sharing the same high-freq token */
function detectCannibalization(pages: import("./crawler").PageData[]): { keyword: string; pages: string[] }[] {
  const titleMap: Record<string, string[]> = {};
  for (const p of pages) {
    for (const tok of extractTokens(p.title)) {
      if (tok.length < 4) continue;
      if (!titleMap[tok]) titleMap[tok] = [];
      titleMap[tok].push(p.url);
    }
  }
  return Object.entries(titleMap)
    .filter(([, urls]) => urls.length >= 3)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 10)
    .map(([keyword, urls]) => ({ keyword, pages: urls.slice(0, 5) }));
}

function buildContextSummary(data: CrawlData, scorer: ScorerResult): string {
  const pages = data.pages.filter(p => p.status === 200);
  const s = scorer.scores;

  // ── Top pages (rich detail, sorted by importance) ──
  const pageTypeOrder: Record<string, number> = {
    home: 0, service: 1, category: 2, collection: 3, product: 4,
    about: 5, contact: 6, faq: 7, blog: 8, podcast: 9, policy: 10, other: 11,
  };
  const topPages = [...pages]
    .sort((a, b) => {
      const typeScore = (pageTypeOrder[a.pageType] ?? 11) - (pageTypeOrder[b.pageType] ?? 11);
      if (typeScore !== 0) return typeScore;
      return b.wordCount - a.wordCount;
    })
    .slice(0, 20)
    .map(p => ({
      url: p.url,
      type: p.pageType,
      title: p.title || "(ไม่มี title)",
      h1: p.h1 || "(ไม่มี h1)",
      h2s: (p.h2s || []).slice(0, 5),
      meta: p.metaDescription ? p.metaDescription.slice(0, 120) : "(ไม่มี meta)",
      words: p.wordCount,
      schemas: p.schemas.map(sc => sc.type),
      internalLinks: p.internalLinks.length,
      missingAlt: p.missingAltCount,
      hasFaq: p.hasFaq,
      hasContact: p.hasContactInfo,
      hasOrg: p.hasOrganizationSchema,
      hasProduct: p.hasProductSchema,
      hasBreadcrumb: p.hasBreadcrumbSchema,
      canonical: p.canonical,
      isNoindex: p.isNoindex,
      hasOg: p.hasOgTitle && p.hasOgImage,
    }));

  // ── All page titles — cap at 100 pages to prevent oversized context on large sites ──
  const allPageTitles = pages.slice(0, 100).map(p =>
    `${p.pageType}|${p.url}|${(p.title || "").replace(/\|/g, " ")}`
  );

  // ── Pre-processed keyword intelligence ──
  const keywordFrequency = buildKeywordFrequencyMap(pages);
  const urlPatterns = buildUrlPatterns(data.allDiscoveredUrls);
  const cannibalization = detectCannibalization(pages);

  // ── Content gap signals ──
  const hasBlog = pages.some(p => p.pageType === "blog");
  const hasFaqPage = pages.some(p => p.pageType === "faq");
  const hasService = pages.some(p => p.pageType === "service");
  const blogCount = pages.filter(p => p.pageType === "blog").length;
  const noIndexPages = pages.filter(p => p.isNoindex).map(p => p.url);
  const missingMetaPages = pages.filter(p => !p.metaDescription).length;
  const missingH1Pages = pages.filter(p => !p.h1).length;
  const missingOgPages = pages.filter(p => !p.hasOgTitle || !p.hasOgImage).length;
  const slowPages = pages.filter(p => p.fetchMs > 2000).map(p => ({ url: p.url, ms: p.fetchMs }));
  const avgFetchMs = pages.length > 0
    ? Math.round(pages.reduce((s, p) => s + p.fetchMs, 0) / pages.length)
    : 0;

  // ── Schema coverage ──
  const schemaCoverage = {
    withAnySchema: pages.filter(p => p.schemas.length > 0).length,
    withOrg: pages.filter(p => p.hasOrganizationSchema).length,
    withProduct: pages.filter(p => p.hasProductSchema).length,
    withBreadcrumb: pages.filter(p => p.hasBreadcrumbSchema).length,
    withFaq: pages.filter(p => p.hasFaqSchema).length,
    withArticle: pages.filter(p => p.hasArticleSchema).length,
  };

  const allIssues = [
    ...scorer.issues.critical.map(i => ({ id: i.id, title: i.title, priority: "critical" })),
    ...scorer.issues.high.map(i => ({ id: i.id, title: i.title, priority: "high" })),
    ...scorer.issues.medium.map(i => ({ id: i.id, title: i.title, priority: "medium" })),
  ];

  return JSON.stringify({
    domain: data.domain,
    baseUrl: data.baseUrl,
    isHttps: data.isHttps,
    languages: data.languages,
    isMultiLanguage: data.isMultiLanguage,
    pages_crawled: pages.length,
    all_discovered_urls: data.allDiscoveredUrls.length,
    sitemap: { found: data.sitemap.found, urlCount: data.sitemap.urlCount, url: data.sitemap.url },
    robots: { found: data.robots.found, disallowedPaths: data.robots.disallowedPaths },
    scores: s,
    nav_items: data.navRawItems.slice(0, 30),

    // Rich page details (top 20 by importance)
    top_pages: topPages,

    // All page titles for full keyword coverage
    all_page_titles: allPageTitles,

    // Pre-processed intelligence
    keyword_frequency: keywordFrequency,
    url_patterns: urlPatterns,
    keyword_cannibalization_risks: cannibalization,

    // Content audit
    content_audit: {
      hasBlog, hasFaqPage, hasService,
      blogCount,
      avg_fetch_ms: avgFetchMs,
      slow_pages: slowPages.slice(0, 5),
      noindex_pages: noIndexPages.slice(0, 10),
      missing_meta_count: missingMetaPages,
      missing_h1_count: missingH1Pages,
      missing_og_count: missingOgPages,
      schema_coverage: schemaCoverage,
    },

    // Issue list
    all_issues: allIssues,

    page_type_counts: {
      home: pages.filter(p => p.pageType === "home").length,
      product: pages.filter(p => p.pageType === "product").length,
      collection: pages.filter(p => p.pageType === "collection").length,
      blog: pages.filter(p => p.pageType === "blog").length,
      service: pages.filter(p => p.pageType === "service").length,
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

// ─── Gemini prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "คุณคือ RankGod — Website Insight Engine ที่รวม AI Agent หลายบทบาทไว้ในระบบเดียว",
  "ทีมใน Agent: SEO Expert, Senior SEO, Content Writer, Keyword Researcher, UX/UI Expert, Creative Expert, Data Analytic, Sales Strategist, Manager, CMO, CEO, Owner",
  "",
  "ภารกิจ: วิเคราะห์ข้อมูลจากเว็บไซต์จริง แล้วสร้าง Insight ใน 5 มิติ สำหรับทุกทีม",
  "1. SEO Insight — หา Opportunity, Gap, Technical Issue, Keyword ที่ยังไม่ได้ใช้",
  "2. Content Insight — วิเคราะห์ว่าเนื้อหาตอบ Search Intent และปิดการขายได้ไหม",
  "3. UX/UI Insight — ชี้จุดที่ทำให้ผู้ใช้ลังเล ไม่กด CTA หรือออกจากหน้า",
  "4. Sales Insight — หามุมขายงานจากปัญหาจริงของเว็บ พร้อม talking point ใช้ได้เลย",
  "5. Business Insight — มองโอกาสเชิงธุรกิจ Lead, Revenue, Organic Growth",
  "",
  "วิธีอ่านข้อมูล (อ่านทั้งหมดก่อนวิเคราะห์):",
  "- top_pages — รายละเอียดหน้าสำคัญ พร้อม title, H1, H2, meta, schema จริง",
  "- all_page_titles — ทุกหน้าในรูป 'pageType|url|title' คัดเลือกหน้าสำคัญและ keyword จากข้อมูลนี้",
  "- keyword_frequency — keyword ที่พบบ่อยจากทุกหน้าจริง",
  "- url_patterns — โครงสร้าง URL จริง บอก section ของเว็บ",
  "- keyword_cannibalization_risks — keyword ที่หลายหน้าแย่งกัน rank",
  "- content_audit — สถิติจริง: missing meta/H1/OG/schema, slow pages, noindex",
  "",
  "กฎที่ห้ามฝ่าฝืน:",
  "1. URL ทุกตัวต้องมาจาก top_pages หรือ all_page_titles — ห้ามแต่ง",
  "2. Keyword ต้องมาจาก keyword_frequency หรือ title จริงใน all_page_titles — ห้าม guess",
  "3. ตัวเลขต้องมาจาก content_audit หรือ scores — ห้ามประมาณ",
  "4. ต้องระบุเจาะจง — URL จริง, ปัญหาจริง, ผลกระทบจริง ห้ามพูดกว้างๆ",
  "5. Insight ทุกข้อต้องตอบว่า: ปัญหาคืออะไร → กระทบธุรกิจอย่างไร → แก้แล้วได้อะไร",
  "6. ภาษา: เขียนเป็นภาษาไทย แต่คำศัพท์ SEO/Marketing ใช้ภาษาอังกฤษได้เลย เช่น Keyword, Backlink, Meta Description, Title Tag, Schema, Crawl Budget, Internal Link, Anchor Text, Search Intent, SERP, CTR, Bounce Rate, Conversion, Landing Page, CTA, Organic Traffic, Ranking, Index, Canonical, Redirect, Page Speed, Core Web Vitals, E-E-A-T, Domain Authority — ไม่ต้องแปลคำเหล่านี้เป็นไทย",
  "",
  "หน้าที่หลักของระบบนี้คือช่วยทีม Sales:",
  "- อ่านข้อมูลทุกหน้าจาก all_page_titles เพื่อเข้าใจเว็บทั้งหมด",
  "- แต่คัดกรองเฉพาะ Insight ที่ Sales เอาไปพูดกับลูกค้าได้ทันที",
  "- salesInsight และ salesTalkingPoints ต้องเขียนเหมือน Sales Script จริง — มีตัวเลข, ปัญหาเจาะจง, และ CTA",
  "- quickWins ต้องเรียง effort ต่ำ→สูง และ impact สูง→ต่ำ เพื่อให้ทีมรู้ว่าทำอะไรก่อน",
  "",
  "Output: JSON object เดียว ไม่มี markdown ไม่มี comment เริ่มด้วย { จบด้วย }",
].join("\n");

// ─── Main function ────────────────────────────────────────────────────────────

export async function runAiAnalysis(
  data: CrawlData,
  scorer: ScorerResult,
  overrideModel?: string
): Promise<AiSeoAnalysis | null> {
  if (!hasGeminiApiKey()) return null;

  const contextSummary = buildContextSummary(data, scorer);
  const pages = data.pages.filter(p => p.status === 200);

  // Pull verified URLs and keywords from actual crawl data for prompt anchoring
  const verifiedPageUrls = pages
    .sort((a, b) => {
      const order: Record<string, number> = { home: 0, service: 1, category: 2, product: 3, about: 4, blog: 5, other: 6 };
      return (order[a.pageType] ?? 6) - (order[b.pageType] ?? 6);
    })
    .slice(0, 15)
    .map(p => p.url);

  const verifiedKeywords = buildKeywordFrequencyMap(pages)
    .slice(0, 20)
    .map(k => k.keyword);

  // ── Vertex AI Grounding (Google Search) — runs in parallel with context build ──
  const businessContext = [
    data.navRawItems.slice(0, 10).join(", "),
    pages.find(p => p.pageType === "home")?.title || "",
  ].filter(Boolean).join(" | ");

  const groundingResult = await runGroundingResearch(
    data.domain,
    verifiedKeywords.slice(0, 5),
    businessContext,
    data.languages[0] || "Thai"
  ).catch(err => {
    console.warn("[aiAnalyzer] Grounding skipped:", String(err).slice(0, 100));
    return null;
  });

  // Build grounding context block for prompt injection
  const groundingBlock = groundingResult ? `
━━━ GOOGLE SEARCH GROUNDING (ข้อมูลจาก Google จริง) ━━━
REAL COMPETITORS FOUND IN GOOGLE:
${groundingResult.competitors.map(c => `- ${c.domain}: ${c.snippet}`).join("\n") || "ไม่พบ"}

KEYWORD SERP CONTEXT:
${groundingResult.keywordInsights.map(k => `- "${k.keyword}": ${k.serpContext}`).join("\n") || "ไม่พบ"}

MARKET CONTEXT:
${groundingResult.marketContext}

GROUNDING SOURCES (${groundingResult.groundingSources.length} sources verified):
${groundingResult.groundingSources.slice(0, 5).join("\n")}
` : "";

  const allIssuesList = [
    ...scorer.issues.critical.map(i => ({ id: i.id, title: i.title })),
    ...scorer.issues.high.map(i => ({ id: i.id, title: i.title })),
    ...scorer.issues.medium.map(i => ({ id: i.id, title: i.title })),
  ];
  const issueInsightsTemplate = allIssuesList.map(issue =>
    `{"id":"${issue.id}","impact":["ผลกระทบเฉพาะของ '${issue.title}' ต่อธุรกิจ ${data.domain} — ระบุ URL หรือตัวเลขจริง"],"fix":["วิธีแก้เฉพาะสำหรับ ${data.domain} — ไม่ใช่ generic advice"]}`
  ).join(",\n    ");

  const userPrompt = `วิเคราะห์เว็บไซต์: ${data.domain}

━━━ DATA FROM REAL CRAWL ━━━
${contextSummary}
${groundingBlock}
━━━ VERIFIED URLS (ใช้ได้เท่านั้น — ห้ามสร้างใหม่) ━━━
${verifiedPageUrls.join("\n")}

━━━ VERIFIED KEYWORDS (จาก title/H1 จริง — ใช้เป็น base) ━━━
${verifiedKeywords.join(", ")}

━━━ INSTRUCTIONS ━━━
1. landingPages.url → ต้องเป็น URL จาก VERIFIED URLS เท่านั้น
2. keywordSignals.keyword → ต้องมาจาก keyword_frequency หรือ VERIFIED KEYWORDS
3. keywordSuggestions → ต้องต่อยอดจาก keyword จริงในเว็บ + suggest long-tail ที่เกี่ยวข้อง
4. competitors → ใช้ข้อมูลจาก GOOGLE SEARCH GROUNDING ถ้ามี มิฉะนั้นอนุมานจาก businessType
5. actionPlan.tasks → ต้องอ้างอิง URL จริง หรือปัญหาจริงจาก content_audit
6. issueInsights → ต้องระบุจำนวนหน้าหรือ URL จริงจาก content_audit ในทุก impact

ตอบเป็น JSON object เดียว ไม่มี markdown เริ่มด้วย { จบด้วย }:

{
  "businessType": "ประเภทธุรกิจที่อนุมานจาก nav_items + title จริง",
  "targetAudience": "กลุ่มเป้าหมายจาก content จริง",
  "currentSeoMaturity": "เริ่มต้น|พัฒนา|ดี|ยอดเยี่ยม",
  "overallVerdict": "สรุป SEO 2-3 ประโยค อ้างอิงคะแนนจริงจาก scores และปัญหาหลัก",
  "salesPitchSummary": "3-4 ประโยคสำหรับ Sales Team — ระบุปัญหาหลักพร้อมตัวเลขจริง (เช่น 'ขาด meta ${pages.filter(p => !p.metaDescription).length} หน้า') เราช่วยอะไรได้ ผลลัพธ์ที่จะได้รับ",
  "executiveSummary": "4-5 ประโยคสำหรับผู้บริหาร — สถานการณ์ปัจจุบันพร้อมตัวเลข โอกาสที่พลาด สิ่งที่ต้องทำ ROI ที่คาดหวัง",
  "actionPlan": [
    {"phase":1,"name":"ชื่อ Phase","duration":"Week 1-2","focus":"โฟกัสจากปัญหาจริง","tasks":["งานระบุ URL/ปัญหาจริงจากเว็บนี้"],"expectedImpact":"ผลลัพธ์จริง"},
    {"phase":2,"name":"ชื่อ Phase","duration":"Month 1","focus":"โฟกัส","tasks":["งานจริง"],"expectedImpact":"ผลลัพธ์"},
    {"phase":3,"name":"ชื่อ Phase","duration":"Month 2","focus":"โฟกัส","tasks":["งานจริง"],"expectedImpact":"ผลลัพธ์"},
    {"phase":4,"name":"ชื่อ Phase","duration":"Month 3","focus":"โฟกัส","tasks":["งานจริง"],"expectedImpact":"ผลลัพธ์"}
  ],
  "expectedResults": {
    "day30": ["ผล 30 วัน จริง ไม่โอ้อวด", "ผล 30 วัน ข้อ 2"],
    "day60": ["ผล 60 วัน จริง", "ผล 60 วัน ข้อ 2"],
    "day90": ["ผล 90 วัน จริง", "ผล 90 วัน ข้อ 2"]
  },
  "siteStructureAnalysis": "วิเคราะห์ url_patterns จริง — บอก section หลัก ความลึก URL และ pattern ที่ดี/แย่",
  "competitiveEdge": "จุดได้เปรียบ/เสียเปรียบจากข้อมูล schema, content, structure จริง",
  "whatIsWorking": ["สิ่งดีจริงจากข้อมูล — อ้างอิง field จาก content_audit หรือ scores"],
  "contentGaps": ["Content ที่ขาดจริงจากเว็บนี้ — อ้างอิงจาก all_page_titles และ keyword_frequency"],
  "landingPages": [
    {"url":"${verifiedPageUrls[0] || data.baseUrl}","topic":"topic จากหน้านี้จริง","strength":"จุดแข็ง","keywords":["${verifiedKeywords[0] || "keyword"}","${verifiedKeywords[1] || "keyword2"}"],"wordCount":${pages[0]?.wordCount || 0}}
  ],
  "keywordSignals": [
    {"keyword":"keyword/phrase จาก keyword_frequency ที่ count สูงสุด","foundIn":"title|h1|h2|meta|url","potential":"สูงมาก|สูง|กลาง|ต่ำ","searchIntent":"transactional|informational|commercial|navigational"},
    {"keyword":"bigram phrase ที่พบบ่อย เช่น 'convert pdf' หรือ 'ขนมปัง โฮลวีต'","foundIn":"title|h2","potential":"สูงมาก","searchIntent":"transactional"},
    {"keyword":"keyword ที่ 3 — ต้องมีอย่างน้อย 10 รายการ","foundIn":"h1","potential":"สูง","searchIntent":"commercial"},
    {"keyword":"keyword ที่ 4","foundIn":"title|meta","potential":"สูง","searchIntent":"informational"},
    {"keyword":"keyword ที่ 5","foundIn":"h2","potential":"กลาง","searchIntent":"informational"},
    {"keyword":"keyword ที่ 6","foundIn":"title","potential":"สูงมาก","searchIntent":"transactional"},
    {"keyword":"keyword ที่ 7","foundIn":"h1|h2","potential":"สูง","searchIntent":"commercial"},
    {"keyword":"keyword ที่ 8","foundIn":"meta","potential":"กลาง","searchIntent":"informational"},
    {"keyword":"keyword ที่ 9","foundIn":"title|h1","potential":"สูง","searchIntent":"transactional"},
    {"keyword":"keyword ที่ 10 — ดึงจาก all_page_titles ถ้า keyword_frequency ไม่พอ","foundIn":"title","potential":"กลาง","searchIntent":"navigational"}
  ],
  "keywordSuggestions": [
    {"group":"กลุ่มหลักจาก keyword ในเว็บ","keywords":["${verifiedKeywords[0] || "kw"}","long-tail variant 1","long-tail variant 2"],"searchIntent":"transactional","priority":"สูงมาก","reason":"เหตุผลจาก keyword_frequency จริง","suggestedPage":"${verifiedPageUrls[1] || "/"}"},
    {"group":"กลุ่มที่ 2","keywords":["kw1","kw2","kw3"],"searchIntent":"commercial","priority":"สูง","reason":"เหตุผล","suggestedPage":"${verifiedPageUrls[2] || "/"}"},
    {"group":"กลุ่มที่ 3","keywords":["kw1","kw2","kw3"],"searchIntent":"informational","priority":"กลาง","reason":"เหตุผล","suggestedPage":"/blog-slug"},
    {"group":"กลุ่มที่ 4","keywords":["kw1","kw2","kw3"],"searchIntent":"transactional","priority":"สูงมาก","reason":"เหตุผล","suggestedPage":"${verifiedPageUrls[3] || "/"}"},
    {"group":"กลุ่มที่ 5","keywords":["kw1","kw2","kw3"],"searchIntent":"commercial","priority":"สูง","reason":"เหตุผล","suggestedPage":"${verifiedPageUrls[4] || "/"}"}
  ],
  "competitors": [
    {"name":"ชื่อ competitor จริงในตลาดเดียวกับ ${data.domain}","domain":"actual-competitor.com","whyFocus":"เหตุผลว่าทำไมต้อง watch เว็บนี้","theirStrengths":["จุดแข็งที่น่าเป็นห่วง"],"gaps":["ช่องว่างที่ ${data.domain} ทำได้ดีกว่า"]},
    {"name":"competitor 2","domain":"competitor2.com","whyFocus":"เหตุผล","theirStrengths":["จุดแข็ง"],"gaps":["ช่องว่าง"]},
    {"name":"competitor 3","domain":"competitor3.com","whyFocus":"เหตุผล","theirStrengths":["จุดแข็ง"],"gaps":["ช่องว่าง"]}
  ],
  "detailedSitemap": [
    {"section":"หมวดหลักจาก nav_items จริง","icon":"📦","pages":[
      {"slug":"/จาก url_patterns จริง","title":"ชื่อหน้าจากข้อมูล","pageType":"product|blog|service","targetKeywords":["kw จริง"],"priority":"high","note":"มีอยู่แล้ว|ต้องปรับ|ต้องสร้างใหม่"}
    ]}
  ],
  "teamActions": [
    {"role":"SEO Specialist","timeframe":"Week 1-2","actions":["งานระบุ URL จริง"],"priority":"ด่วน"},
    {"role":"Web Developer","timeframe":"Month 1","actions":["งานจริง"],"priority":"สำคัญ"},
    {"role":"Content Writer","timeframe":"Month 2","actions":["งานจริง"],"priority":"ทำเพิ่ม"}
  ],
  "issueInsights": [
    ${issueInsightsTemplate}
  ],

  "websiteInsightSummary": "2-3 ประโยค ภาพรวมที่ทุกทีมอ่านเข้าใจได้ทันที — เว็บนี้มีปัญหาอะไร เสียโอกาสตรงไหน และถ้าแก้จะได้อะไร อ้างอิงตัวเลขจริงจาก content_audit",

  "seoOpportunity": [
    "Keyword opportunity ที่ยังไม่ได้ใช้จาก keyword_frequency — ระบุ keyword + หน้าที่ควรเพิ่ม",
    "Technical SEO ที่กระทบ ranking — อ้างอิงตัวเลขจาก content_audit",
    "Internal link opportunity — หน้าไหนควรเชื่อมกับหน้าไหน",
    "Content gap เมื่อเทียบกับ Search Intent จริง"
  ],

  "contentOpportunity": [
    {"gap":"สิ่งที่เนื้อหาขาดหรือตอบไม่ครบ","why":"เหตุผลว่าทำไมนี่คือ gap จาก top_pages จริง","suggestion":"คำแนะนำเฉพาะ เช่น ควรเพิ่ม FAQ เกี่ยวกับ X ในหน้า Y","pageType":"blog|service|product|landing"},
    {"gap":"gap ที่ 2","why":"เหตุผล","suggestion":"แนะนำ","pageType":"service"}
  ],

  "uxInsights": [
    {"issue":"ปัญหา UX ที่เห็นจากโครงสร้างหน้าจริง เช่น ไม่มี CTA บนหน้า service","impact":"กระทบอย่างไรต่อ Conversion","fix":"วิธีแก้เฉพาะเจาะจง","location":"URL หรือ section ที่พบปัญหา"},
    {"issue":"ปัญหา UX ที่ 2","impact":"ผลกระทบ","fix":"วิธีแก้","location":"URL"}
  ],

  "salesInsight": "3-4 ประโยคที่ทีม Sales เอาไปพูดกับลูกค้าได้ทันที — เปิดด้วยปัญหาจริงที่เจอจากเว็บ ระบุตัวเลข บอกว่าเราช่วยอะไรได้ และผลลัพธ์ที่ลูกค้าจะได้รับ",

  "salesTalkingPoints": [
    "Talking point 1: เปิดด้วยปัญหาที่เจอจริงจากเว็บ ระบุ URL หรือตัวเลข",
    "Talking point 2: เสียโอกาสทาง SEO ตรงไหน กระทบยอดขายอย่างไร",
    "Talking point 3: ถ้าแก้แล้วลูกค้าได้อะไร — Lead, Traffic, Revenue",
    "Talking point 4: เหตุผลว่าทำไมต้องทำตอนนี้"
  ],

  "businessInsights": [
    {"opportunity":"โอกาสทางธุรกิจที่เห็นจากเว็บนี้","currentState":"สถานการณ์ปัจจุบันของเว็บ อ้างอิงข้อมูลจริง","potentialImpact":"ผลลัพธ์ที่คาดว่าจะได้ถ้าแก้ไข","investment":"สิ่งที่ต้องลงทุน: เวลา, คน, งบ"},
    {"opportunity":"โอกาสที่ 2","currentState":"สถานการณ์","potentialImpact":"ผลลัพธ์","investment":"การลงทุน"}
  ],

  "quickWins": [
    {"task":"งานที่ทำได้เลย ผลเร็ว อ้างอิง URL จริง","role":"SEO|Content|Dev|UX","effort":"ต่ำ","impact":"สูงมาก","timeframe":"วันนี้"},
    {"task":"Quick win ที่ 2","role":"Content","effort":"ต่ำ","impact":"สูง","timeframe":"สัปดาห์นี้"},
    {"task":"Quick win ที่ 3","role":"Dev","effort":"กลาง","impact":"สูงมาก","timeframe":"สัปดาห์นี้"},
    {"task":"Quick win ที่ 4","role":"SEO","effort":"ต่ำ","impact":"สูง","timeframe":"เดือนนี้"},
    {"task":"Quick win ที่ 5","role":"UX","effort":"กลาง","impact":"สูง","timeframe":"เดือนนี้"}
  ],

  "roleInsights": [
    {"role":"Sales","priority":"ด่วน","insight":"insight เฉพาะสำหรับทีม Sales — มุมขาย ปัญหาที่ขายได้ ตัวเลขที่โน้มน้าวลูกค้า","actions":["action 1","action 2"]},
    {"role":"SEO","priority":"ด่วน","insight":"insight สำหรับทีม SEO — ปัญหาหลัก โอกาส keyword ที่พลาด","actions":["action 1","action 2"]},
    {"role":"Content","priority":"สำคัญ","insight":"insight สำหรับ Content Writer — gap, Search Intent ที่ยังไม่ครอบคลุม","actions":["action 1","action 2"]},
    {"role":"UX/Creative","priority":"สำคัญ","insight":"insight สำหรับทีม UX/Creative — จุดที่ทำให้ผู้ใช้ลังเลหรือออก","actions":["action 1","action 2"]},
    {"role":"Manager/CMO","priority":"สำคัญ","insight":"insight สำหรับ Manager และ CMO — ภาพรวม ROI และ priority","actions":["action 1","action 2"]},
    {"role":"CEO/Owner","priority":"ทำเพิ่ม","insight":"insight สำหรับ CEO/Owner — เว็บนี้เป็น Asset หรือ Brochure, โอกาสลด Ads Cost","actions":["action 1","action 2"]}
  ]
}`;

  const isRetryableError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const msg = String((err as Record<string, unknown>).message || err).toLowerCase();
    return msg.includes("429") || msg.includes("503") || msg.includes("overloaded") ||
           msg.includes("quota") || msg.includes("fetch failed") || msg.includes("econnreset") ||
           msg.includes("etimedout") || msg.includes("network") || msg.includes("socket") ||
           msg.includes("404") || msg.includes("not found") || msg.includes("not supported") ||
           msg.includes("not exist");
  };

  const primaryModel = overrideModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModel = "gemini-2.5-flash";
  const MODEL_SEQUENCE = primaryModel === fallbackModel
    ? [primaryModel, primaryModel]
    : [primaryModel, primaryModel, fallbackModel, fallbackModel];

  const PRICING: Record<string, { input: number; output: number }> = {
    "gemini-3.5-flash": { input: 0.15, output: 0.60 },
    "gemini-2.5-flash": { input: 0.15, output: 0.60 },
    "gemini-2.5-pro":   { input: 1.25, output: 10.00 },
  };

  let _inputTokens = 0;
  let _outputTokens = 0;
  let _costUsd = 0;

  const attemptCall = async (modelName: string): Promise<string> => {
    console.log(`[aiAnalyzer] Calling Gemini model: ${modelName}, context ~${Math.round(contextSummary.length / 1000)}KB`);
    const { text, result } = await generateGeminiText({
      modelName,
      systemInstruction: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 65536,
      temperature: 0.2,
      topP: 0.85,
    });
    const response = result.response;
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      console.warn(`[aiAnalyzer] Gemini finish reason: ${finishReason}`);
    }
    // Token usage + cost
    const usage = readGeminiUsage(result);
    const price = PRICING[modelName] ?? PRICING["gemini-2.5-pro"];
    if (usage && (usage.promptTokenCount || usage.candidatesTokenCount)) {
      const inputCost  = ((usage.promptTokenCount     || 0) / 1_000_000) * price.input;
      const outputCost = ((usage.candidatesTokenCount || 0) / 1_000_000) * price.output;
      const totalCost  = inputCost + outputCost;
      _inputTokens = usage.promptTokenCount ?? 0;
      _outputTokens = usage.candidatesTokenCount ?? 0;
      _costUsd = totalCost;
      console.log(
        `[aiAnalyzer] Tokens — input: ${usage.promptTokenCount?.toLocaleString()}, output: ${usage.candidatesTokenCount?.toLocaleString()} | ` +
        `Cost — $${inputCost.toFixed(4)} + $${outputCost.toFixed(4)} = $${totalCost.toFixed(4)} USD (~฿${(totalCost * 34).toFixed(2)})`
      );
    } else {
      // Fallback: estimate from context size (approx 4 chars/token)
      const estimatedInput = Math.round(userPrompt.length / 4);
      const estimatedOutput = 4000;
      const inputCost  = (estimatedInput  / 1_000_000) * price.input;
      const outputCost = (estimatedOutput / 1_000_000) * price.output;
      _inputTokens = estimatedInput;
      _outputTokens = estimatedOutput;
      _costUsd = inputCost + outputCost;
      console.log(
        `[aiAnalyzer] Tokens (estimated) — input: ~${estimatedInput.toLocaleString()}, output: ~${estimatedOutput.toLocaleString()} | ` +
        `Cost (est) — $${_costUsd.toFixed(4)} USD (~฿${(_costUsd * 34).toFixed(2)})`
      );
    }
    return text;
  };

  try {
    let responseText: string | undefined;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MODEL_SEQUENCE.length; attempt++) {
      const model = MODEL_SEQUENCE[attempt];
      try {
        responseText = await attemptCall(model);
        console.log(`[aiAnalyzer] Success with Gemini model: ${model}`);
        break;
      } catch (err: unknown) {
        lastErr = err;
        if (isRetryableError(err) && attempt < MODEL_SEQUENCE.length - 1) {
          const wait = attempt < 2 ? 5000 : 12000;
          console.log(`[aiAnalyzer] ${model} error (attempt ${attempt + 1}/${MODEL_SEQUENCE.length}), retrying in ${wait / 1000}s...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          console.error(`[aiAnalyzer] Failed with model ${model}:`, String(err).slice(0, 200));
          throw err;
        }
      }
    }

    if (!responseText) throw lastErr;

    const parsed = safeParseJson<AiSeoAnalysis>(responseText);
    if (!parsed) return null;

    // Hard validation — reject entirely if core real-data fields are missing
    // No fabricated fallbacks allowed: every field must come from Gemini's analysis of actual site data
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
    if (!parsed.whatIsWorking)        parsed.whatIsWorking = [];
    if (!parsed.contentGaps)          parsed.contentGaps = [];
    if (!parsed.landingPages)         parsed.landingPages = [];
    if (!parsed.keywordSignals)       parsed.keywordSignals = [];
    if (!parsed.keywordSuggestions)   parsed.keywordSuggestions = [];
    if (!parsed.competitors)          parsed.competitors = [];
    if (!parsed.detailedSitemap)      parsed.detailedSitemap = [];
    if (!parsed.teamActions)          parsed.teamActions = [];
    if (!parsed.issueInsights)        parsed.issueInsights = [];
    if (!parsed.seoOpportunity)       parsed.seoOpportunity = [];
    if (!parsed.contentOpportunity)   parsed.contentOpportunity = [];
    if (!parsed.uxInsights)           parsed.uxInsights = [];
    if (!parsed.salesTalkingPoints)   parsed.salesTalkingPoints = [];
    if (!parsed.businessInsights)     parsed.businessInsights = [];
    if (!parsed.quickWins)            parsed.quickWins = [];
    if (!parsed.roleInsights)         parsed.roleInsights = [];
    if (!parsed.websiteInsightSummary) parsed.websiteInsightSummary = "";
    if (!parsed.salesInsight)         parsed.salesInsight = "";

    // Attach cost metadata (read by siteAudit.ts to build CostSummary)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = parsed as any;
    p._costUsd = _costUsd;
    p._inputTokens = _inputTokens;
    p._outputTokens = _outputTokens;

    return parsed;
  } catch (err) {
    console.error("[aiAnalyzer] Gemini error:", err);
    return null;
  }
}
