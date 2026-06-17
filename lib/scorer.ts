/**
 * Score calculation — follows blueprint logic exactly
 * Returns scores/10 per category + detailed issues with evidence
 */
import type { CrawlData, PageData } from "./crawler";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IssuePriority = "critical" | "high" | "medium" | "low";

export interface FoundItem {
  url?: string;
  page?: string;
  label?: string;
  current?: string;
  recommended?: string;
  status?: number | null;
  value?: string | number;
  note?: string;
}

export interface SeoIssue {
  id: string;
  priority: IssuePriority;
  category: "technical" | "onpage" | "content" | "schema" | "ux" | "structure";
  title: string;
  found: FoundItem[];
  impact: string[];
  fix: string[];
  effortDays: number;
  impactLevel: "สูงมาก" | "สูง" | "กลาง-สูง" | "กลาง" | "ต่ำ";
  affectedCount: number;
}

export interface SeoScores {
  technical: number;    // /10
  onpage: number;       // /10
  siteStructure: number; // /10
  uxUi: number;         // /10
  contentQuality: number; // /10
  overall: number;      // weighted average
}

export interface SitemapRecommended {
  home: string;
  collections: string[];
  products: string;
  pages: string[];
  blogs: string[];
  other: string[];
}

export interface ScorerResult {
  scores: SeoScores;
  issues: {
    critical: SeoIssue[];
    high: SeoIssue[];
    medium: SeoIssue[];
    low: SeoIssue[];
  };
  strengths: string[];
  sitemapRecommended: SitemapRecommended;
  pageTypeMap: Record<string, string>; // url → pageType
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 10): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function calcTechnical(data: CrawlData): number {
  let score = 10;
  if (!data.sitemap.found) score -= 3;
  if (!data.robots.found) score -= 2;
  if (!data.isHttps) score -= 3;
  const brokenPages = data.pages.filter(p => p.status && p.status >= 400).length;
  if (brokenPages > 0) score -= Math.min(2, brokenPages);
  const noCanonical = data.pages.filter(p => !p.canonical).length;
  if (noCanonical > data.pages.length * 0.5) score -= 1;
  // New checks
  const canonicalMismatch = data.pages.filter(p => p.canonicalMismatch).length;
  if (canonicalMismatch > 0) score -= Math.min(2, canonicalMismatch);
  const noindex = data.pages.filter(p => p.isNoindex && ["home","product","category","blog"].includes(p.pageType)).length;
  if (noindex > 0) score -= Math.min(2, noindex);
  const avgFetchMs = data.pages.length ? data.pages.reduce((s, p) => s + p.fetchMs, 0) / data.pages.length : 0;
  if (avgFetchMs > 5000) score -= 2;
  else if (avgFetchMs > 3000) score -= 1;
  return clamp(score);
}

function calcOnPage(data: CrawlData): number {
  let score = 10;
  const pages = data.pages.filter(p => p.status === 200);
  if (pages.length === 0) return 5;
  const noTitle = pages.filter(p => !p.title).length;
  const noMeta = pages.filter(p => !p.metaDescription).length;
  const noH1 = pages.filter(p => !p.h1).length;
  const pct = (n: number) => n / pages.length;
  if (pct(noTitle) > 0.1) score -= 2;
  if (pct(noMeta) > 0.2) score -= 2;
  if (pct(noH1) > 0.1) score -= 2;
  // Duplicate titles
  const titles = pages.map(p => p.title).filter(Boolean);
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size < titles.length * 0.8) score -= 2;
  // hreflang if multi-language
  if (data.isMultiLanguage) {
    const hasHreflang = pages.filter(p => p.hreflang.length > 0).length;
    if (hasHreflang < pages.length * 0.5) score -= 1;
  }
  // New: OG tags, multiple H1, heading hierarchy
  const noOg = pages.filter(p => !p.hasOgTitle || !p.hasOgImage).length;
  if (pct(noOg) > 0.6) score -= 1;
  const multiH1 = pages.filter(p => p.hasMultipleH1).length;
  if (pct(multiH1) > 0.2) score -= 1;
  return clamp(score);
}

function calcSiteStructure(data: CrawlData): number {
  let score = 10;
  if (!data.sitemap.found) score -= 2;
  const pages = data.pages.filter(p => p.status === 200);
  const noBreadcrumb = pages.filter(p => !p.hasBreadcrumbSchema).length;
  if (noBreadcrumb > pages.length * 0.7) score -= 2;
  // Internal linking
  const poorInternal = pages.filter(p => p.internalLinks.length < 3).length;
  if (poorInternal > pages.length * 0.5) score -= 2;
  // URL structure
  const deepUrls = data.allDiscoveredUrls.filter(u => { try { return new URL(u).pathname.split("/").filter(Boolean).length > 4; } catch { return false; } }).length;
  if (deepUrls > data.allDiscoveredUrls.length * 0.3) score -= 1;
  // Broken nav
  if (data.navRawItems.some(i => /^[A-Z_]{3,}$/.test(i))) score -= 1;
  // Broken pages
  const broken = data.pages.filter(p => p.status && p.status >= 400).length;
  if (broken > 0) score -= Math.min(2, broken);
  return clamp(score);
}

function calcUxUi(data: CrawlData): number {
  let score = 10;
  const pages = data.pages.filter(p => p.status === 200);
  // No CTA
  const noCta = pages.filter(p => !p.hasCtaButton).length;
  if (noCta > pages.length * 0.5) score -= 2;
  // No viewport
  const noViewport = pages.filter(p => !p.viewport).length;
  if (noViewport > 0) score -= Math.min(3, noViewport);
  // Missing alt
  const missingAlt = pages.filter(p => p.missingAltCount > 0).length;
  if (missingAlt > pages.length * 0.4) score -= 1;
  // Nav broken items
  const broken = data.navRawItems.filter(i => /^[A-Z_]{3,}$/.test(i));
  if (broken.length > 0) score -= 2;
  // Contact info
  const noContact = pages.filter(p => !p.hasContactInfo && (p.pageType === "home" || p.pageType === "contact")).length;
  if (noContact > 0) score -= 1;
  return clamp(score);
}

function calcContentQuality(data: CrawlData): number {
  let score = 10;
  const pages = data.pages.filter(p => p.status === 200);
  if (pages.length === 0) return 5;
  // Thin content
  const thin = pages.filter(p => p.wordCount < 300).length;
  if (thin > pages.length * 0.5) score -= 3;
  else if (thin > pages.length * 0.2) score -= 1;
  // No schema
  const noSchema = pages.filter(p => p.schemas.length === 0).length;
  if (noSchema > pages.length * 0.7) score -= 2;
  // Product pages with short titles (model code only)
  const productPages = pages.filter(p => p.pageType === "product");
  const shortProductTitles = productPages.filter(p => p.title && p.title.length < 20).length;
  if (shortProductTitles > productPages.length * 0.5) score -= 2;
  // FAQ
  const hasFaqPage = pages.some(p => p.hasFaq || p.pageType === "faq");
  if (!hasFaqPage) score -= 1;
  // Author/date for blog
  const blogPages = pages.filter(p => p.pageType === "blog");
  const noAuthor = blogPages.filter(p => !p.hasAuthor).length;
  if (noAuthor > blogPages.length * 0.5 && blogPages.length > 0) score -= 1;
  return clamp(score);
}

// ─── Issue builders ───────────────────────────────────────────────────────────

function buildIssues(data: CrawlData): ScorerResult["issues"] {
  const critical: SeoIssue[] = [];
  const high: SeoIssue[] = [];
  const medium: SeoIssue[] = [];
  const low: SeoIssue[] = [];

  const pages = data.pages.filter(p => p.status === 200 || p.status === null);
  const total = pages.length;

  // ── CRITICAL ──────────────────────────────────────────────────────────────

  if (!data.sitemap.found || !data.robots.found) {
    critical.push({
      id: "no_sitemap_robots",
      priority: "critical",
      category: "technical",
      title: `ไม่มี ${!data.sitemap.found ? "Sitemap.xml" : ""}${!data.sitemap.found && !data.robots.found ? " และ " : ""}${!data.robots.found ? "Robots.txt" : ""}`,
      found: [
        { url: `${data.baseUrl}/sitemap.xml`, status: data.sitemap.found ? 200 : 404 },
        { url: `${data.baseUrl}/robots.txt`, status: data.robots.found ? 200 : 404 },
      ],
      impact: [
        "Google Bot ไม่รู้ว่าเว็บมีหน้าอะไรบ้าง",
        "การ crawl ไม่มีประสิทธิภาพ เสีย crawl budget",
        "หน้าสำคัญอาจไม่ถูก Index",
      ],
      fix: [
        "Generate sitemap.xml ครอบคลุมทุก URL สำคัญ",
        "สร้าง robots.txt ระบุ Sitemap URL",
        "Submit sitemap ใน Google Search Console",
      ],
      effortDays: 1,
      impactLevel: "สูงมาก",
      affectedCount: pages.length,
    });
  }

  // Duplicate / missing titles
  const titlesAll = pages.map(p => p.title).filter(Boolean) as string[];
  const titleMap: Record<string, number> = {};
  titlesAll.forEach(t => { titleMap[t] = (titleMap[t] || 0) + 1; });
  const dupTitles = Object.entries(titleMap).filter(([, c]) => c > 1);
  const noTitlePages = pages.filter(p => !p.title);

  if (noTitlePages.length > 0 || dupTitles.length > 0) {
    critical.push({
      id: "duplicate_missing_title",
      priority: "critical",
      category: "onpage",
      title: `Title Tag ${noTitlePages.length > 0 ? `ขาดหาย ${noTitlePages.length} หน้า` : ""}${noTitlePages.length > 0 && dupTitles.length > 0 ? " และ " : ""}${dupTitles.length > 0 ? `ซ้ำกัน ${dupTitles.length} กลุ่ม` : ""}`,
      found: [
        ...noTitlePages.slice(0, 3).map(p => ({ page: p.url, current: "(ไม่มี Title)" })),
        ...dupTitles.slice(0, 3).map(([t, c]) => ({ page: `พบซ้ำ ${c} หน้า`, current: t })),
      ],
      impact: [
        "Google ไม่มีข้อความแสดงใน SERP → สุ่มดึงข้อความเอง",
        "CTR ลดลง 30-50% เพราะ snippet ไม่น่าคลิก",
        "Title ซ้ำทำให้เกิด Keyword Cannibalization",
      ],
      fix: [
        "เพิ่ม Title ทุกหน้า รูปแบบ: [Keyword หลัก] | [ชื่อแบรนด์]",
        "ความยาว 50-60 ตัวอักษร ห้ามซ้ำกัน",
        "ใส่ Primary Keyword ที่คนค้นหาจริงๆ",
      ],
      effortDays: 1,
      impactLevel: "สูงมาก",
      affectedCount: noTitlePages.length + dupTitles.length,
    });
  }

  // Missing meta description
  const noMetaPages = pages.filter(p => !p.metaDescription);
  if (noMetaPages.length > total * 0.15) {
    critical.push({
      id: "no_meta_description",
      priority: "critical",
      category: "onpage",
      title: `ไม่มี Meta Description ${noMetaPages.length} หน้า (${Math.round(noMetaPages.length / total * 100)}%)`,
      found: noMetaPages.slice(0, 4).map(p => ({ page: p.url, value: `${p.wordCount} คำ`, note: "meta: ว่างเปล่า" })),
      impact: [
        `CTR ต่ำกว่าปกติ 20-30% — Google สุ่มดึงข้อความแทน`,
        "ข้อความใน SERP ไม่น่าสนใจ ไม่มี CTA",
      ],
      fix: [
        "เพิ่ม Meta Description ทุกหน้า 140-155 ตัวอักษร",
        "ใส่ Primary Keyword + จุดขาย + Call-to-Action",
        "ห้ามซ้ำกันระหว่างหน้า",
      ],
      effortDays: 2,
      impactLevel: "สูง",
      affectedCount: noMetaPages.length,
    });
  }

  // Missing H1
  const noH1Pages = pages.filter(p => !p.h1);
  if (noH1Pages.length > 0) {
    (noH1Pages.length > total * 0.3 ? critical : high).push({
      id: "missing_h1",
      priority: noH1Pages.length > total * 0.3 ? "critical" : "high",
      category: "onpage",
      title: `H1 ขาดหาย ${noH1Pages.length} หน้า`,
      found: noH1Pages.slice(0, 4).map(p => ({ page: p.url, current: "(ไม่มี H1)" })),
      impact: [
        "Google ไม่รู้ว่าหน้านี้เกี่ยวกับ keyword อะไร",
        "โอกาส rank keyword หลักลดลง 30-50%",
      ],
      fix: [
        "เพิ่ม H1 ทุกหน้า — ใส่ Primary Keyword ของหน้านั้น",
        "H1 ควรมีแค่ 1 tag ต่อหน้า",
        "ห้ามใช้ H1 เป็นแค่ชื่อแบรนด์ ต้องมี Keyword",
      ],
      effortDays: 1,
      impactLevel: "สูงมาก",
      affectedCount: noH1Pages.length,
    });
  }

  // ── HIGH ──────────────────────────────────────────────────────────────────

  // Broken nav items
  const brokenNav = data.navRawItems.filter(i => /^[A-Z_]{3,}$/.test(i) || /^(ITEM|VIDEO|BLOCK|NODE)_\d+/i.test(i));
  if (brokenNav.length > 0) {
    high.push({
      id: "broken_nav_items",
      priority: "high",
      category: "ux",
      title: `Navigation Menu มี item ผิดปกติ ${brokenNav.length} รายการ`,
      found: brokenNav.map(label => ({ label, type: "raw_variable" })),
      impact: [
        "เสียความน่าเชื่อถือต่อผู้เยี่ยมชม",
        "บ่งบอกว่า CMS configuration มีปัญหา",
      ],
      fix: ["ลบ item ที่แสดงผิดปกติออกจาก Menu", "ตรวจสอบ Menu configuration ใน CMS"],
      effortDays: 0.5,
      impactLevel: "สูง",
      affectedCount: brokenNav.length,
    });
  }

  // Schema missing
  const noSchemaPages = pages.filter(p => p.schemas.length === 0);
  if (noSchemaPages.length > total * 0.4) {
    const missingSchemaSummary: FoundItem[] = [];
    const home = pages.find(p => p.pageType === "home");
    if (home && !home.hasOrganizationSchema) missingSchemaSummary.push({ page: "Homepage", note: "ขาด Organization, WebSite → เสียโอกาส Knowledge Panel" });
    const productPage = pages.find(p => p.pageType === "product");
    if (productPage && !productPage.hasProductSchema) missingSchemaSummary.push({ page: "Product pages", note: "ขาด Product, Offer, AggregateRating → เสียดาว + ราคาใน Google" });
    const faqPage = pages.find(p => p.hasFaq || p.pageType === "faq");
    if (faqPage && !faqPage.hasFaqSchema) missingSchemaSummary.push({ page: "FAQ page", note: "ขาด FAQPage Schema → เสีย FAQ Rich Result" });
    if (noSchemaPages.some(p => !p.hasBreadcrumbSchema)) missingSchemaSummary.push({ page: "ทุกหน้า", note: "ขาด BreadcrumbList → เสีย breadcrumb ใน SERP" });

    high.push({
      id: "no_schema_markup",
      priority: "high",
      category: "schema",
      title: `ไม่มี Schema Markup ${noSchemaPages.length} หน้า (${Math.round(noSchemaPages.length / total * 100)}%)`,
      found: missingSchemaSummary.length > 0 ? missingSchemaSummary : [{ note: `${noSchemaPages.length} หน้าไม่มี structured data` }],
      impact: [
        "เสียโอกาส Rich Result: ดาว, ราคา, FAQ Box ใน Google",
        "CTR ต่ำกว่าคู่แข่งที่มี Schema",
        "ไม่มี Knowledge Panel สำหรับแบรนด์",
      ],
      fix: [
        "เพิ่ม Organization + WebSite Schema ที่ Homepage",
        "เพิ่ม Product + Offer + AggregateRating ที่ทุก Product page",
        "เพิ่ม FAQPage Schema ที่หน้า FAQ",
        "เพิ่ม BreadcrumbList ทุกหน้า",
      ],
      effortDays: 5,
      impactLevel: "สูงมาก",
      affectedCount: noSchemaPages.length,
    });
  }

  // Weak H1 (has H1 but no meaningful keyword)
  const weakH1Pages = pages.filter(p => p.h1 && p.h1.length < 15);
  if (weakH1Pages.length > 0) {
    high.push({
      id: "weak_h1",
      priority: "high",
      category: "onpage",
      title: `H1 สั้น/ไม่มี Keyword ${weakH1Pages.length} หน้า`,
      found: weakH1Pages.slice(0, 4).map(p => ({ page: p.url, current: p.h1 || "" })),
      impact: ["Google ไม่เข้าใจ Topic ของหน้า", "Keyword signal อ่อนมาก"],
      fix: ["แก้ H1 ให้ประกอบด้วย Primary Keyword + บอก value ของหน้า", "ความยาว 30-70 ตัวอักษร"],
      effortDays: 1,
      impactLevel: "สูง",
      affectedCount: weakH1Pages.length,
    });
  }

  // Product titles too short (model code only)
  const productPages = pages.filter(p => p.pageType === "product");
  const thinProductTitles = productPages.filter(p => p.title && p.title.replace(/[^a-zA-Z0-9]/g, "").length < 15);
  if (thinProductTitles.length > productPages.length * 0.3 && thinProductTitles.length > 0) {
    high.push({
      id: "product_title_model_code_only",
      priority: "high",
      category: "content",
      title: `Product Title ใช้แค่ Model Code ${thinProductTitles.length} สินค้า`,
      found: thinProductTitles.slice(0, 4).map(p => ({ page: p.url, current: p.title || "" })),
      impact: [
        "คนไม่ค้นหาด้วย model code — ค้นหาด้วยชื่อสินค้า",
        "เสียโอกาส rank keyword เชิงพรรณนา",
      ],
      fix: [
        "ปรับ Title เป็น: [ชื่อแบรนด์] [Model] [คำอธิบาย keyword]",
        "เช่น: CC022 → Brand CC022 รองเท้าสุขภาพ ลดอาการรองช้ำ",
      ],
      effortDays: 5,
      impactLevel: "กลาง-สูง",
      affectedCount: thinProductTitles.length,
    });
  }

  // Thin content
  const thinPages = pages.filter(p => p.wordCount < 300);
  if (thinPages.length > total * 0.3) {
    high.push({
      id: "thin_content",
      priority: "high",
      category: "content",
      title: `เนื้อหาบาง (<300 คำ) พบ ${thinPages.length} หน้า`,
      found: thinPages.slice(0, 4).map(p => ({ page: p.url, value: p.wordCount, note: "คำ" })),
      impact: [
        "Google มองว่า low-quality content",
        "โอกาส rank ลดลงมาก โดยเฉพาะ informational queries",
        `เฉลี่ยทั้งเว็บ ${Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / pages.length)} คำ/หน้า`,
      ],
      fix: [
        "เพิ่มเนื้อหาให้ถึง 800-1,200 คำ/หน้า",
        "เพิ่ม FAQ, รีวิว, วิธีใช้, ข้อมูลเปรียบเทียบ",
        "ลิ้งค์ไปหน้าที่เกี่ยวข้องเพื่อเพิ่ม context",
      ],
      effortDays: 14,
      impactLevel: "สูง",
      affectedCount: thinPages.length,
    });
  }

  // Broken pages
  const brokenPages = data.pages.filter(p => p.status && p.status >= 400);
  if (brokenPages.length > 0) {
    (brokenPages.length > 3 ? critical : high).push({
      id: "broken_pages",
      priority: brokenPages.length > 3 ? "critical" : "high",
      category: "technical",
      title: `พบ ${brokenPages.length} หน้าที่ตอบกลับ Error (${[...new Set(brokenPages.map(p => p.status))].join(", ")})`,
      found: brokenPages.slice(0, 5).map(p => ({ url: p.url, status: p.status })),
      impact: [
        "Google ลด crawl budget เมื่อพบ error มาก",
        "ผู้ใช้เจอหน้า error = เสียความน่าเชื่อถือ",
      ],
      fix: [
        "Redirect 301 ไปหน้าที่ถูกต้อง หรือแก้ content",
        "ลบออกจาก Sitemap",
        "ตรวจสอบใน Google Search Console",
      ],
      effortDays: 1,
      impactLevel: "สูงมาก",
      affectedCount: brokenPages.length,
    });
  }

  // ── MEDIUM ─────────────────────────────────────────────────────────────────

  // hreflang missing for multi-language
  if (data.isMultiLanguage) {
    const noHreflang = pages.filter(p => p.hreflang.length === 0);
    if (noHreflang.length > total * 0.4) {
      medium.push({
        id: "missing_hreflang",
        priority: "medium",
        category: "technical",
        title: `ขาด hreflang Tag — เว็บมีหลายภาษา (${data.languages.join(", ")})`,
        found: [{ note: `${noHreflang.length} หน้าไม่มี hreflang — ภาษาที่พบ: ${data.languages.join(", ")}` }],
        impact: [
          "Google อาจแสดงหน้าผิดภาษาให้ผู้ใช้",
          "เนื้อหาภาษาต่างๆ แย่งกัน rank",
        ],
        fix: [
          `เพิ่ม hreflang link tags ใน <head> ทุกหน้า`,
          `<link rel="alternate" hreflang="th" href="[th-url]">`,
          `<link rel="alternate" hreflang="en" href="[en-url]">`,
        ],
        effortDays: 2,
        impactLevel: "กลาง",
        affectedCount: noHreflang.length,
      });
    }
  }

  // No breadcrumb schema
  const noBreadcrumb = pages.filter(p => !p.hasBreadcrumbSchema && (p.pageType === "product" || p.pageType === "collection" || p.pageType === "blog"));
  if (noBreadcrumb.length > 0) {
    medium.push({
      id: "no_breadcrumb",
      priority: "medium",
      category: "structure",
      title: `ไม่มี Breadcrumb Navigation/Schema ${noBreadcrumb.length} หน้า`,
      found: [{ note: `ตัวอย่าง: หน้าหลัก › สินค้าทั้งหมด › Category › Product` }],
      impact: [
        "เสียโอกาสแสดง Breadcrumb ใน Google SERP",
        "ผู้ใช้นำทางลำบาก → Bounce Rate สูง",
      ],
      fix: [
        "เพิ่ม BreadcrumbList Schema JSON-LD ทุกหน้า product/collection",
        "เพิ่ม breadcrumb navigation จริงใน HTML",
      ],
      effortDays: 2,
      impactLevel: "กลาง",
      affectedCount: noBreadcrumb.length,
    });
  }

  // Missing alt text
  const missingAltPages = pages.filter(p => p.missingAltCount > 0);
  if (missingAltPages.length > 0) {
    medium.push({
      id: "missing_alt_text",
      priority: "medium",
      category: "content",
      title: `รูปภาพขาด Alt Text — ${missingAltPages.length} หน้า`,
      found: missingAltPages.slice(0, 4).map(p => ({ page: p.url, value: p.missingAltCount, note: "รูปไม่มี alt" })),
      impact: [
        "เสีย traffic จาก Google Image Search",
        "Lighthouse Accessibility score ต่ำ",
        "Screen reader อ่านไม่ได้",
      ],
      fix: [
        "เพิ่ม alt text ทุกรูป อธิบายเนื้อหารูป + ใส่ keyword เป็นธรรมชาติ",
        "สำหรับ product image: alt = ชื่อสินค้า + model",
      ],
      effortDays: 3,
      impactLevel: "กลาง",
      affectedCount: missingAltPages.length,
    });
  }

  // No CTA
  const noCtaPages = pages.filter(p => !p.hasCtaButton && p.pageType !== "policy");
  if (noCtaPages.length > total * 0.4) {
    medium.push({
      id: "no_cta",
      priority: "medium",
      category: "ux",
      title: `ไม่มี Call-to-Action ชัดเจน ${noCtaPages.length} หน้า`,
      found: noCtaPages.slice(0, 3).map(p => ({ page: p.url })),
      impact: [
        "คนเข้าเว็บแล้วออก ไม่รู้จะทำอะไรต่อ",
        "Conversion rate ต่ำ — traffic ไม่แปลงเป็น lead",
      ],
      fix: [
        "เพิ่มปุ่ม CTA ทุกหน้า: ติดต่อเรา / ดูสินค้า / ขอใบเสนอราคา",
        "วาง CTA ให้เห็นได้ทันทีโดยไม่ต้อง scroll",
      ],
      effortDays: 3,
      impactLevel: "กลาง",
      affectedCount: noCtaPages.length,
    });
  }

  // Poor internal linking
  const poorLinkPages = pages.filter(p => p.internalLinks.length < 3);
  if (poorLinkPages.length > total * 0.4) {
    medium.push({
      id: "poor_internal_linking",
      priority: "medium",
      category: "structure",
      title: `Internal Link น้อยกว่า 3 ลิ้งค์/หน้า — พบ ${poorLinkPages.length} หน้า`,
      found: poorLinkPages.slice(0, 4).map(p => ({ page: p.url, value: p.internalLinks.length, note: "internal links" })),
      impact: [
        "Google Crawl bot ค้นหาหน้าได้ยาก — บางหน้าอาจไม่ถูก Index",
        "PageRank ไม่กระจายทั่วเว็บ",
      ],
      fix: [
        "เพิ่ม internal link 3-5 ลิ้งค์/หน้า ไปหน้าที่เกี่ยวข้อง",
        "ใช้ anchor text ที่มี keyword — ไม่ใช่แค่ 'คลิกที่นี่'",
      ],
      effortDays: 5,
      impactLevel: "กลาง",
      affectedCount: poorLinkPages.length,
    });
  }

  // ── NEW: Noindex pages detection ───────────────────────────────────────────
  const noindexPages = pages.filter(p => p.isNoindex);
  if (noindexPages.length > 0) {
    const isLikely = noindexPages.some(p => ["home","product","category","collection","blog"].includes(p.pageType));
    (isLikely ? high : medium).push({
      id: "noindex_pages",
      priority: isLikely ? "high" : "medium",
      category: "technical",
      title: `พบหน้า noindex ${noindexPages.length} หน้า — Google ไม่ Index`,
      found: noindexPages.slice(0, 5).map(p => ({ page: p.url, current: p.metaRobots || "noindex", note: p.pageType })),
      impact: [
        "หน้าที่ตั้งค่า noindex จะไม่ปรากฏใน Google เลย",
        isLikely ? "พบ noindex ในหน้าสำคัญ (home/product/blog) — อาจเกิดจากความผิดพลาด" : "ตรวจสอบว่าตั้งใจตั้งหรือตั้งผิด",
      ],
      fix: [
        "ตรวจสอบ meta robots tag ใน <head> ทุกหน้าสำคัญ",
        "ลบ noindex ออกจากหน้าที่ต้องการให้ติดอันดับ",
        "ยืนยันใน Google Search Console > URL Inspection",
      ],
      effortDays: 1,
      impactLevel: isLikely ? "สูงมาก" : "กลาง",
      affectedCount: noindexPages.length,
    });
  }

  // ── NEW: Multiple H1 tags ──────────────────────────────────────────────────
  const multiH1Pages = pages.filter(p => p.hasMultipleH1);
  if (multiH1Pages.length > 0) {
    medium.push({
      id: "multiple_h1",
      priority: "medium",
      category: "onpage",
      title: `H1 มากกว่า 1 tag ต่อหน้า — พบ ${multiH1Pages.length} หน้า`,
      found: multiH1Pages.slice(0, 4).map(p => ({ page: p.url, value: p.h1Count, note: "H1 tags" })),
      impact: [
        "Google สับสนว่า Topic หลักของหน้าคืออะไร",
        "Keyword signal เจือจาง — แต่ละ H1 แย่ง authority กัน",
      ],
      fix: [
        "ทุกหน้าควรมีแค่ 1 H1 tag — เป็น Primary Keyword หลัก",
        "แท็กที่เหลือให้ลดลงเป็น H2 หรือ H3",
      ],
      effortDays: 1,
      impactLevel: "กลาง",
      affectedCount: multiH1Pages.length,
    });
  }

  // ── NEW: Heading hierarchy issues (H3 before H2, no H2 but has H3) ─────────
  const badHierarchyPages = pages.filter(p =>
    p.h1 && p.h3Count > 0 && p.h2Count === 0  // H3 without H2
  );
  if (badHierarchyPages.length > 0) {
    medium.push({
      id: "heading_hierarchy",
      priority: "medium",
      category: "onpage",
      title: `โครงสร้าง Heading ไม่ถูกต้อง (H3 ไม่มี H2 นำ) — ${badHierarchyPages.length} หน้า`,
      found: badHierarchyPages.slice(0, 4).map(p => ({
        page: p.url,
        current: `H1:1, H2:${p.h2Count}, H3:${p.h3Count}`,
      })),
      impact: [
        "โครงสร้าง content ไม่ชัดเจน — Google เข้าใจ topic hierarchy ได้ยาก",
        "Accessibility ต่ำ — screen reader อ่านผิดลำดับ",
      ],
      fix: [
        "ลำดับควรเป็น H1 → H2 → H3 ห้ามข้ามชั้น",
        "ทุก section ใหญ่ใช้ H2, subsection ใช้ H3",
      ],
      effortDays: 2,
      impactLevel: "กลาง",
      affectedCount: badHierarchyPages.length,
    });
  }

  // ── NEW: OG Tags missing ───────────────────────────────────────────────────
  const noOgPages = pages.filter(p => !p.hasOgTitle || !p.hasOgImage);
  if (noOgPages.length > total * 0.5) {
    medium.push({
      id: "missing_og_tags",
      priority: "medium",
      category: "onpage",
      title: `ขาด Open Graph Tags (Social Preview) — ${noOgPages.length} หน้า`,
      found: noOgPages.slice(0, 3).map(p => ({
        page: p.url,
        note: `og:title: ${p.hasOgTitle ? "✓" : "✗"}  og:image: ${p.hasOgImage ? "✓" : "✗"}`,
      })),
      impact: [
        "แชร์ลิ้งค์ผ่าน Facebook/LINE/Twitter ไม่มีรูปหรือชื่อ",
        "เสีย CTR จาก Social Media traffic",
        "ดูไม่น่าเชื่อถือเมื่อแชร์",
      ],
      fix: [
        "เพิ่ม og:title, og:description, og:image ทุกหน้า",
        "รูป og:image ควรขนาด 1200×630px",
        "ใช้ plugin หรือ template CMS ตั้งค่าอัตโนมัติ",
      ],
      effortDays: 2,
      impactLevel: "กลาง",
      affectedCount: noOgPages.length,
    });
  }

  // ── NEW: Canonical mismatch / cross-domain canonical ──────────────────────
  const canonicalMismatchPages = pages.filter(p => p.canonicalMismatch);
  if (canonicalMismatchPages.length > 0) {
    high.push({
      id: "canonical_mismatch",
      priority: "high",
      category: "technical",
      title: `Canonical Tag ชี้ไป domain อื่น — ${canonicalMismatchPages.length} หน้า`,
      found: canonicalMismatchPages.slice(0, 4).map(p => ({ page: p.url, current: p.canonical || "" })),
      impact: [
        "Google จะให้ credit SEO ไปที่ domain ที่ canonical ชี้ถึงแทน",
        "เนื้อหาในเว็บนี้จะไม่ถูก Index ถ้า canonical ชี้ออกนอก",
      ],
      fix: [
        "ตรวจสอบ canonical ให้ชี้มาที่ domain ของตัวเองเท่านั้น",
        "canonical ควรเป็น self-referencing หรือชี้ไป URL หลักในกลุ่มเดียวกัน",
      ],
      effortDays: 1,
      impactLevel: "สูงมาก",
      affectedCount: canonicalMismatchPages.length,
    });
  }

  // ── NEW: Pages with no canonical at all ───────────────────────────────────
  const noCanonical = pages.filter(p => !p.canonical && (p.pageType !== "other"));
  if (noCanonical.length > total * 0.5) {
    medium.push({
      id: "missing_canonical",
      priority: "medium",
      category: "technical",
      title: `ไม่มี Canonical Tag — ${noCanonical.length} หน้า`,
      found: noCanonical.slice(0, 4).map(p => ({ page: p.url, note: p.pageType })),
      impact: [
        "Google อาจเลือก URL ที่ไม่ต้องการเป็น canonical เอง",
        "URL parameter ต่างๆ (/page/2, ?sort=) อาจถูกมองเป็นหน้าซ้ำ",
      ],
      fix: [
        "เพิ่ม <link rel='canonical' href='[self-url]'> ทุกหน้า",
        "ใช้ plugin/CMS ตั้งค่า canonical อัตโนมัติ",
      ],
      effortDays: 2,
      impactLevel: "กลาง",
      affectedCount: noCanonical.length,
    });
  }

  // ── NEW: Page speed signal from fetch time ────────────────────────────────
  const slowPages = pages.filter(p => p.fetchMs > 3000);
  const avgFetchMs = pages.length > 0
    ? Math.round(pages.reduce((s, p) => s + p.fetchMs, 0) / pages.length)
    : 0;
  if (slowPages.length > total * 0.3 || avgFetchMs > 3000) {
    (avgFetchMs > 5000 ? high : medium).push({
      id: "slow_server_response",
      priority: avgFetchMs > 5000 ? "high" : "medium",
      category: "technical",
      title: `Server Response ช้า — เฉลี่ย ${(avgFetchMs / 1000).toFixed(1)}s (${slowPages.length} หน้าเกิน 3s)`,
      found: slowPages.slice(0, 4).map(p => ({ page: p.url, value: `${(p.fetchMs / 1000).toFixed(1)}s` })),
      impact: [
        "Google PageSpeed ใช้ TTFB เป็น Core Web Vital ส่งผลต่อ ranking",
        `${slowPages.length} หน้าตอบกลับช้ากว่า 3 วินาที`,
        "ผู้ใช้มักออกจากเว็บถ้าโหลดเกิน 3 วินาที",
      ],
      fix: [
        "ใช้ CDN เพื่อลด latency (Cloudflare แนะนำ)",
        "เปิด GZIP/Brotli compression",
        "Optimize database queries / hosting tier",
        "ตรวจสอบ Core Web Vitals ใน Google Search Console",
      ],
      effortDays: 5,
      impactLevel: avgFetchMs > 5000 ? "สูง" : "กลาง-สูง",
      affectedCount: slowPages.length,
    });
  }

  // ── NEW: Keyword Cannibalization detection ────────────────────────────────
  const keywordMap: Record<string, string[]> = {};
  pages.forEach(p => {
    p.titleKeywords.forEach(kw => {
      if (!keywordMap[kw]) keywordMap[kw] = [];
      keywordMap[kw].push(p.url);
    });
  });
  const cannibalizedKws = Object.entries(keywordMap)
    .filter(([, urls]) => urls.length >= 3)
    .slice(0, 5);
  if (cannibalizedKws.length > 0) {
    medium.push({
      id: "keyword_cannibalization",
      priority: "medium",
      category: "content",
      title: `พบสัญญาณ Keyword Cannibalization — ${cannibalizedKws.length} keyword groups ซ้ำกัน`,
      found: cannibalizedKws.map(([kw, urls]) => ({
        label: `"${kw}"`,
        note: `พบใน ${urls.length} หน้า: ${urls.slice(0, 2).map(u => { try { return new URL(u).pathname; } catch { return u; } }).join(", ")}`,
      })),
      impact: [
        "หน้าหลายหน้าแย่งกัน rank keyword เดียวกัน",
        "Google สับสนว่าหน้าไหนสำคัญที่สุด — ทุกหน้า rank ได้แย่ลง",
        "Authority กระจาย ไม่รวมศูนย์",
      ],
      fix: [
        "กำหนด 1 Primary Keyword ต่อ 1 หน้าเท่านั้น",
        "หน้าที่ซ้ำซ้อน: รวม (merge) หรือ redirect ไปหน้าหลัก",
        "ใช้ canonical ชี้ไปหน้าที่ต้องการให้ rank",
      ],
      effortDays: 7,
      impactLevel: "กลาง-สูง",
      affectedCount: cannibalizedKws.reduce((s, [, urls]) => s + urls.length, 0),
    });
  }

  // ── NEW: Content depth — no H2 on important pages ────────────────────────
  const noH2ImportantPages = pages.filter(p =>
    ["home", "product", "category", "blog", "service"].includes(p.pageType) &&
    p.h2Count === 0 && p.wordCount > 200
  );
  if (noH2ImportantPages.length > 2) {
    medium.push({
      id: "no_h2_structure",
      priority: "medium",
      category: "content",
      title: `หน้าสำคัญไม่มี H2 — ${noH2ImportantPages.length} หน้า`,
      found: noH2ImportantPages.slice(0, 4).map(p => ({ page: p.url, note: p.pageType })),
      impact: [
        "เนื้อหาเป็นก้อนเดียว Google เข้าใจ subtopic ได้ยาก",
        "เสียโอกาสใส่ Secondary Keyword ใน heading",
        "ผู้อ่านอ่านยาก ไม่มี visual hierarchy",
      ],
      fix: [
        "แบ่งเนื้อหาเป็นหัวข้อด้วย H2 (3-6 H2 ต่อหน้า)",
        "ใส่ Secondary Keyword ใน H2",
        "H2 ควรตอบคำถามที่ผู้ใช้ต้องการ",
      ],
      effortDays: 3,
      impactLevel: "กลาง",
      affectedCount: noH2ImportantPages.length,
    });
  }

  return { critical, high, medium, low };
}

// ─── Sitemap recommended ──────────────────────────────────────────────────────

function buildSitemapRecommended(data: CrawlData): SitemapRecommended {
  const pages = data.pages;
  const collections = [...new Set(pages.filter(p => p.pageType === "collection").map(p => {
    try { return new URL(p.url).pathname; } catch { return p.url; }
  }))].slice(0, 15);

  const staticPages = [...new Set(pages.filter(p => ["faq", "about", "contact", "policy"].includes(p.pageType)).map(p => {
    try { return new URL(p.url).pathname; } catch { return p.url; }
  }))].slice(0, 10);

  const blogs = [...new Set(pages.filter(p => p.pageType === "blog").map(p => {
    try { return new URL(p.url).pathname; } catch { return p.url; }
  }))].slice(0, 10);

  const productCount = pages.filter(p => p.pageType === "product").length;

  return {
    home: "/",
    collections,
    products: productCount > 0 ? `/products/[product-slug] (${productCount} สินค้า)` : "",
    pages: staticPages,
    blogs,
    other: data.allDiscoveredUrls
      .filter(u => { try { const p = new URL(u).pathname; return p !== "/" && !collections.includes(p) && !staticPages.includes(p); } catch { return false; } })
      .map(u => { try { return new URL(u).pathname; } catch { return u; } })
      .slice(0, 10),
  };
}

// ─── Strengths ────────────────────────────────────────────────────────────────

function detectStrengths(data: CrawlData): string[] {
  const strengths: string[] = [];
  const pages = data.pages.filter(p => p.status === 200);

  if (data.isHttps) strengths.push("ใช้ HTTPS — Google ให้ความสำคัญด้าน security");
  if (data.sitemap.found) strengths.push(`มี Sitemap.xml ครอบคลุม ${data.sitemap.urlCount} URL`);
  if (data.robots.found) strengths.push("มี Robots.txt — ควบคุม crawling ได้");
  if (data.isMultiLanguage) strengths.push(`รองรับหลายภาษา (${data.languages.join(", ")})`);

  const withSchema = pages.filter(p => p.schemas.length > 0).length;
  if (withSchema > pages.length * 0.3) strengths.push(`${withSchema} หน้ามี Schema Markup แล้ว`);

  const faqPage = pages.find(p => p.hasFaq || p.pageType === "faq");
  if (faqPage) strengths.push("มีหน้า FAQ — ช่วย People Also Ask ใน Google");

  const withMeta = pages.filter(p => p.metaDescription).length;
  if (withMeta > pages.length * 0.7) strengths.push(`${withMeta} หน้ามี Meta Description แล้ว`);

  const productCount = pages.filter(p => p.pageType === "product").length;
  if (productCount > 5) strengths.push(`${productCount} product pages — ฐาน content ดี`);

  const collectionCount = pages.filter(p => p.pageType === "collection").length;
  if (collectionCount > 3) strengths.push(`${collectionCount} collection pages — โครงสร้างสินค้าชัดเจน`);

  const withContact = pages.filter(p => p.hasContactInfo).length;
  if (withContact > pages.length * 0.5) strengths.push("ข้อมูลติดต่อพบได้หลายหน้า — ดีสำหรับ E-E-A-T");

  if (strengths.length === 0) strengths.push("เว็บออนไลน์และ accessible ได้");

  return strengths;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function scoreSite(data: CrawlData): ScorerResult {
  const scores: SeoScores = {
    technical: calcTechnical(data),
    onpage: calcOnPage(data),
    siteStructure: calcSiteStructure(data),
    uxUi: calcUxUi(data),
    contentQuality: calcContentQuality(data),
    overall: 0,
  };
  scores.overall = clamp(Math.round(
    scores.technical * 0.25 +
    scores.onpage * 0.25 +
    scores.siteStructure * 0.15 +
    scores.uxUi * 0.15 +
    scores.contentQuality * 0.20
  ));

  const issues = buildIssues(data);
  const strengths = detectStrengths(data);
  const sitemapRecommended = buildSitemapRecommended(data);

  const pageTypeMap: Record<string, string> = {};
  data.pages.forEach(p => { pageTypeMap[p.url] = p.pageType; });

  return { scores, issues, strengths, sitemapRecommended, pageTypeMap };
}
