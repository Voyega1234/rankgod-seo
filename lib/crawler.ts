/**
 * Full-site crawler — collects all data per the blueprint checklist
 * Returns raw CrawlData used by scorer + AI analyzer
 */
import * as cheerio from "cheerio";
import { fetchPage } from "./fetchPage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageData {
  url: string;
  status: number | null;
  fetchMs: number;
  fetchError: string | null;
  finalUrl: string | null;

  // <head>
  title: string | null;
  titleLength: number;
  titleHasKeyword: boolean | null; // resolved later
  metaDescription: string | null;
  metaDescLength: number;
  metaRobots: string | null;
  canonical: string | null;
  hreflang: Array<{ lang: string; href: string }>;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  viewport: boolean;

  // Headings
  h1: string | null;
  h1Count: number;
  h2s: string[];
  h3s: string[];
  headingHierarchyOk: boolean;

  // Content
  wordCount: number;
  paragraphCount: number;
  hasAuthor: boolean;
  hasDate: boolean;
  hasFaq: boolean;
  hasContactInfo: boolean;
  hasCtaButton: boolean;

  // Schema
  schemas: Array<{ type: string; raw: Record<string, unknown> }>;
  hasOrganizationSchema: boolean;
  hasProductSchema: boolean;
  hasFaqSchema: boolean;
  hasBreadcrumbSchema: boolean;
  hasArticleSchema: boolean;
  hasWebsiteSchema: boolean;

  // Images
  imageCount: number;
  missingAltCount: number;
  imagesWithAlt: number;

  // Links
  internalLinks: Array<{ href: string; text: string; nofollow: boolean }>;
  externalLinks: Array<{ href: string; text: string; nofollow: boolean }>;
  brokenNavItems: string[];

  // Navigation (only meaningful on homepage)
  navItems: string[];

  // Canonical issues
  canonicalIsSelf: boolean;       // canonical points to itself (good)
  canonicalMismatch: boolean;     // canonical points to different domain

  // Index signals
  isNoindex: boolean;             // meta robots has noindex
  isNofollow: boolean;            // meta robots has nofollow

  // OG / Social completeness
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;

  // Heading hierarchy
  hasMultipleH1: boolean;         // more than 1 H1 tag
  h2Count: number;
  h3Count: number;

  // External link quality
  externalNofollowCount: number;
  externalDofollowCount: number;

  // Keyword cannibalization signals
  titleKeywords: string[];        // extracted keyword tokens from title

  // Content depth
  hasTableOfContents: boolean;
  hasNumberedList: boolean;
  hasTable: boolean;

  // Page type detection
  pageType: "home" | "product" | "collection" | "faq" | "about" | "contact" | "blog" | "policy" | "podcast" | "service" | "category" | "other";

  // Brand color (from homepage)
  brandColors: string[];

  // Raw snippet for AI
  bodySnippet: string;
}

export interface SitemapData {
  found: boolean;
  url: string | null;
  status: number | null;
  urls: string[];
  urlCount: number;
  lastmod: string | null;
}

export interface RobotsData {
  found: boolean;
  status: number | null;
  content: string | null;
  sitemapDeclared: boolean;
  disallowedPaths: string[];
}

export interface CrawlData {
  domain: string;
  baseUrl: string;
  hostname: string;
  isHttps: boolean;
  sitemap: SitemapData;
  robots: RobotsData;
  pages: PageData[];
  allDiscoveredUrls: string[];
  crawledAt: string;
  homepageData: PageData | null;
  languages: string[];
  isMultiLanguage: boolean;
  navRawItems: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPageType(url: string, h1: string | null, title: string | null): PageData["pageType"] {
  const u = url.toLowerCase();
  if (u.match(/\/(products?|สินค้า|item)\//)) return "product";
  if (u.match(/\/(collections?|category|หมวด|catalog|หมวดหมู่)\//)) return "category";
  if (u.match(/\/(service|บริการ|solution)\//)) return "service";
  if (u.match(/\/(faq|คำถาม|help|ช่วยเหลือ)/)) return "faq";
  if (u.match(/\/(about|เกี่ยวกับ|ทีม|team)/)) return "about";
  if (u.match(/\/(contact|ติดต่อ)/)) return "contact";
  if (u.match(/\/(podcast|episode|ep)\//)) return "podcast";
  if (u.match(/\/(blog|news|article|บทความ|ข่าว|insight|learn|th-TH\/learn)\//)) return "blog";
  if (u.match(/\/(policy|term|privacy|return|refund|นโยบาย)/)) return "policy";
  const path = new URL(url.startsWith("http") ? url : `https://x.com${url}`).pathname;
  if (path === "/" || path === "") return "home";
  return "other";
}

function extractBrandColors(html: string): string[] {
  const colors: Set<string> = new Set();
  // Extract from CSS custom properties and inline styles
  const cssVarRegex = /--[a-z-]*color[a-z-]*:\s*(#[0-9a-fA-F]{3,8}|rgb[^;]+)/gi;
  const hexRegex = /background(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi;
  let m;
  while ((m = cssVarRegex.exec(html)) !== null) colors.add(m[1].trim());
  while ((m = hexRegex.exec(html)) !== null) colors.add(m[1].trim());
  // Filter out near-white / near-black, keep mid-tone brand colors
  return [...colors]
    .filter(c => {
      if (!c.startsWith("#") || c.length < 7) return false;
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      const lum = (r + g + b) / 3;
      return lum > 20 && lum < 230; // not pure black/white
    })
    .slice(0, 5);
}

function extractNavItems($: cheerio.CheerioAPI): string[] {
  const items: string[] = [];
  $("nav a, header a, [role='navigation'] a").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 60) items.push(text);
  });
  return [...new Set(items)].slice(0, 30);
}

function detectBrokenNavItems(items: string[]): string[] {
  // Detect items that look like unresolved template variables or raw codes
  return items.filter(item =>
    /^[A-Z_]{3,}$/.test(item) ||          // all caps with underscores = raw variable
    /\{[^}]+\}/.test(item) ||              // template {{var}}
    /^(ITEM|VIDEO|BLOCK|NODE|VAR)_\d+$/i.test(item)
  );
}

// ─── Parse single page ────────────────────────────────────────────────────────

export function parsePage(html: string, url: string, fetchMs: number, status: number | null): PageData {
  const $ = cheerio.load(html);

  // Remove noise
  $("script:not([type='application/ld+json']), style, noscript, svg").remove();

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const metaRobots = $('meta[name="robots"]').attr("content")?.trim() || null;
  const viewport = !!$('meta[name="viewport"]').attr("content");
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;

  // hreflang
  const hreflang: Array<{ lang: string; href: string }> = [];
  $('link[rel="alternate"]').each((_, el) => {
    const lang = $(el).attr("hreflang");
    const href = $(el).attr("href");
    if (lang && href) hreflang.push({ lang, href });
  });

  // Headings
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim() || null;
  const h1Count = $("h1").length;
  const h2s = $("h2").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  const h3s = $("h3").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  const headingHierarchyOk = h1Count === 1 && (h2s.length > 0 || h3s.length === 0);

  // Schema
  const schemas: Array<{ type: string; raw: Record<string, unknown> }> = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}") as Record<string, unknown>;
      const extract = (d: Record<string, unknown>) => {
        if (d["@type"]) schemas.push({ type: String(d["@type"]), raw: d });
        if (Array.isArray(d["@graph"])) {
          (d["@graph"] as Record<string, unknown>[]).forEach(item => extract(item));
        }
      };
      extract(data);
    } catch {}
  });

  const schemaTypes = schemas.map(s => s.type.toLowerCase());
  const hasOrganizationSchema = schemaTypes.some(t => t.includes("organization"));
  const hasProductSchema = schemaTypes.some(t => t.includes("product"));
  const hasFaqSchema = schemaTypes.some(t => t.includes("faq"));
  const hasBreadcrumbSchema = schemaTypes.some(t => t.includes("breadcrumb"));
  const hasArticleSchema = schemaTypes.some(t => t.includes("article") || t.includes("blogpost"));
  const hasWebsiteSchema = schemaTypes.some(t => t.includes("website"));

  // Content — prefer semantic content zones to avoid nav/footer boilerplate inflating counts
  const contentEl = $("main, article, [role='main'], #content, .content, .post-content, .entry-content, .page-content").first();
  const contentText = contentEl.length
    ? contentEl.text().replace(/\s+/g, " ").trim()
    : $("p").map((_, el) => $(el).text()).get().join(" ").replace(/\s+/g, " ").trim();
  // Fall back to body only if nothing meaningful found
  const bodyText = contentText.length > 50 ? contentText : $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 1).length;
  const paragraphCount = $("p").length;

  const hasAuthor = !!$('[class*="author"], [rel="author"], .author, [itemprop="author"]').length;
  const hasDate = !!$('[class*="date"], time, [itemprop="datePublished"]').length;
  const faqKeywords = /\b(faq|คำถาม|ถามตอบ|frequently|question)/i;
  const hasFaq = faqKeywords.test(url) || faqKeywords.test(title || "") || $("[class*='faq'], [id*='faq']").length > 0 || $("details").length > 3;
  const hasContactInfo = /(\+66|0[0-9]{8,9}|@|line\.me|facebook\.com|LINE ID)/i.test(bodyText);
  const hasCtaButton = $("a[class*='btn'], button, a[class*='cta'], a[class*='buy'], a[class*='order']").length > 0;

  // Images
  const imageCount = $("img").length;
  const missingAltCount = $("img:not([alt]), img[alt='']").length;
  const imagesWithAlt = imageCount - missingAltCount;

  // Links
  const internalLinks: PageData["internalLinks"] = [];
  const externalLinks: PageData["externalLinks"] = [];
  const baseHostname = (() => { try { return new URL(url).hostname; } catch { return ""; } })();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().slice(0, 80);
    const nofollow = ($(el).attr("rel") || "").includes("nofollow");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const abs = href.startsWith("http") ? href : new URL(href, url).href;
      const isInternal = new URL(abs).hostname === baseHostname || new URL(abs).hostname.endsWith(`.${baseHostname}`);
      if (isInternal) internalLinks.push({ href: abs, text, nofollow });
      else externalLinks.push({ href: abs, text, nofollow });
    } catch {}
  });

  const navItems = extractNavItems($);
  const brokenNavItems = detectBrokenNavItems(navItems);
  const brandColors = extractBrandColors(html);
  const pageType = detectPageType(url, h1, title);
  const bodySnippet = bodyText.slice(0, 2000);

  // Canonical quality checks
  const canonicalIsSelf = !canonical || canonical === url || (() => {
    try { return new URL(canonical).pathname === new URL(url).pathname; } catch { return false; }
  })();
  const canonicalMismatch = !!canonical && (() => {
    try {
      const cHost = new URL(canonical).hostname.replace(/^www\./, "");
      const pHost = new URL(url).hostname.replace(/^www\./, "");
      return cHost !== pHost;
    } catch { return false; }
  })();

  // Index signals
  const isNoindex = /noindex/i.test(metaRobots || "");
  const isNofollow = /nofollow/i.test(metaRobots || "");

  // OG completeness
  const hasOgTitle = !!ogTitle;
  const hasOgDescription = !!ogDescription;
  const hasOgImage = !!ogImage;

  // Heading depth
  const hasMultipleH1 = h1Count > 1;
  const h2Count = h2s.length;
  const h3Count = h3s.length;

  // External link nofollow ratio
  const externalNofollowCount = externalLinks.filter(l => l.nofollow).length;
  const externalDofollowCount = externalLinks.filter(l => !l.nofollow).length;

  // Title keyword tokens (simple tokenization, min 3 chars)
  const titleKeywords = (title || "").toLowerCase()
    .split(/[\s|,\-–—:]+/)
    .map(w => w.replace(/[^a-z0-9ก-๙]/g, ""))
    .filter(w => w.length >= 3);

  // Content depth signals
  const hasTableOfContents = $("[class*='toc'], [id*='toc'], [class*='table-of-content']").length > 0
    || /สารบัญ|table of content/i.test(bodyText.slice(0, 500));
  const hasNumberedList = $("ol li").length > 2;
  const hasTable = $("table").length > 0;

  return {
    url, status, fetchMs, fetchError: null, finalUrl: null,
    title, titleLength: title?.length || 0, titleHasKeyword: null,
    metaDescription, metaDescLength: metaDescription?.length || 0,
    metaRobots, canonical, hreflang, ogTitle, ogDescription, ogImage, viewport,
    h1, h1Count, h2s, h3s, headingHierarchyOk,
    wordCount, paragraphCount, hasAuthor, hasDate, hasFaq, hasContactInfo, hasCtaButton,
    schemas, hasOrganizationSchema, hasProductSchema, hasFaqSchema, hasBreadcrumbSchema, hasArticleSchema, hasWebsiteSchema,
    imageCount, missingAltCount, imagesWithAlt,
    internalLinks, externalLinks, brokenNavItems, navItems,
    pageType, brandColors, bodySnippet,
    canonicalIsSelf, canonicalMismatch,
    isNoindex, isNofollow,
    hasOgTitle, hasOgDescription, hasOgImage,
    hasMultipleH1, h2Count, h3Count,
    externalNofollowCount, externalDofollowCount,
    titleKeywords,
    hasTableOfContents, hasNumberedList, hasTable,
  };
}

// ─── Sitemap ──────────────────────────────────────────────────────────────────

async function crawlSitemap(base: string): Promise<SitemapData> {
  const hostname = new URL(base).hostname;
  const candidates = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/wp-sitemap.xml`,
    `${base}/sitemap/sitemap.xml`,
  ];

  for (const sUrl of candidates) {
    const r = await fetchPage(sUrl);
    if (!r.html || (r.status !== 200 && r.status !== 301)) continue;

    const xml = r.html;
    // index sitemap → recurse
    const subSitemaps = [...xml.matchAll(/<loc>(https?:\/\/[^<]+\.xml[^<]*)<\/loc>/gi)].map(m => m[1]);
    let allUrls: string[] = [];
    let lastmod: string | null = null;

    if (subSitemaps.length > 0) {
      for (const sub of subSitemaps.slice(0, 10)) {
        const sr = await fetchPage(sub);
        if (sr.html) {
          const found = [...sr.html.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)].map(m => m[1]);
          allUrls.push(...found);
          const lm = sr.html.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
          if (lm && !lastmod) lastmod = lm;
        }
      }
    } else {
      const found = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)].map(m => m[1]);
      allUrls = found;
      lastmod = xml.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || null;
    }

    // Filter to same domain, no images/media
    allUrls = [...new Set(allUrls.filter(u => {
      try {
        const p = new URL(u);
        return p.hostname === hostname && !u.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|xml)$/i);
      } catch { return false; }
    }))];

    return { found: true, url: sUrl, status: r.status, urls: allUrls, urlCount: allUrls.length, lastmod };
  }

  return { found: false, url: null, status: null, urls: [], urlCount: 0, lastmod: null };
}

// ─── Robots ───────────────────────────────────────────────────────────────────

async function crawlRobots(base: string): Promise<RobotsData> {
  const r = await fetchPage(`${base}/robots.txt`);
  if (!r.html || r.status !== 200) {
    return { found: false, status: r.status, content: null, sitemapDeclared: false, disallowedPaths: [] };
  }
  const content = r.html;
  const sitemapDeclared = /^sitemap:/im.test(content);
  const disallowedPaths = [...content.matchAll(/^Disallow:\s*(.+)/gim)].map(m => m[1].trim()).filter(Boolean);
  return { found: true, status: r.status, content: content.slice(0, 2000), sitemapDeclared, disallowedPaths };
}

// ─── Discover URLs ────────────────────────────────────────────────────────────

function discoverUrlsFromPage(page: PageData, hostname: string): string[] {
  return page.internalLinks
    .map(l => l.href)
    .filter(href => {
      try { return new URL(href).hostname === hostname; } catch { return false; }
    });
}

// ─── Main crawl ───────────────────────────────────────────────────────────────

export async function crawlSite(domain: string): Promise<CrawlData> {
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain}`;
  const hostname = new URL(base).hostname;
  const isHttps = base.startsWith("https");

  // Time budget: leave ~90s for AI analysis, stop crawling at 200s
  const startedAt = Date.now();
  const CRAWL_BUDGET_MS = 200_000;
  const timeLeft = () => CRAWL_BUDGET_MS - (Date.now() - startedAt);

  // 1. Sitemap + robots in parallel
  const [sitemap, robots] = await Promise.all([crawlSitemap(base), crawlRobots(base)]);

  // 2. Collect URLs: sitemap first, then crawl homepage for more
  let urlQueue: string[] = sitemap.urls.length > 0 ? sitemap.urls : [base];

  // 3. Crawl homepage first to get nav + brand colors
  const homeResult = await fetchPage(base);
  let homepageData: PageData | null = null;
  let navRawItems: string[] = [];

  if (homeResult.html) {
    homepageData = parsePage(homeResult.html, base, 0, homeResult.status);
    navRawItems = homepageData.navItems;
    const discovered = discoverUrlsFromPage(homepageData, hostname);
    for (const u of discovered) {
      if (!urlQueue.includes(u)) urlQueue.push(u);
    }
  }

  // 4. Deduplicate + limit (cap at 100 for speed, prioritize product/collection pages)
  const allUrls = [...new Set(urlQueue)]
    .filter(u => { try { return new URL(u).hostname === hostname; } catch { return false; } })
    .filter(u => !u.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|xml)$/i));

  // Prioritize: home, product, collection, then others
  const priority = (u: string) => {
    const p = new URL(u).pathname.toLowerCase();
    if (p === "/" || p === "") return 0;
    if (p.match(/\/(product|สินค้า|item)\//)) return 1;
    if (p.match(/\/(collection|category|หมวด)\//)) return 2;
    if (p.match(/\/(faq|about|contact|blog|article)/)) return 3;
    return 4;
  };
  urlQueue = allUrls.sort((a, b) => priority(a) - priority(b)).slice(0, 100);

  // 5. Crawl in batches of 5, respect time budget
  const pages: PageData[] = [];
  if (homepageData) pages.push(homepageData);

  const remaining = urlQueue.filter(u => u !== base && u !== base + "/");
  const BATCH = 5;

  for (let i = 0; i < remaining.length; i += BATCH) {
    if (timeLeft() < 30_000) {
      console.log(`[crawler] time budget reached after ${pages.length} pages`);
      break;
    }
    const batch = remaining.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async url => {
      const start = Date.now();
      const r = await fetchPage(url);
      if (!r.html) return {
        url, status: r.status, fetchMs: Date.now() - start, fetchError: r.error, finalUrl: null,
        title: null, titleLength: 0, titleHasKeyword: null,
        metaDescription: null, metaDescLength: 0, metaRobots: null,
        canonical: null, hreflang: [], ogTitle: null, ogDescription: null, ogImage: null, viewport: false,
        h1: null, h1Count: 0, h2s: [], h3s: [], headingHierarchyOk: false,
        wordCount: 0, paragraphCount: 0, hasAuthor: false, hasDate: false, hasFaq: false, hasContactInfo: false, hasCtaButton: false,
        schemas: [], hasOrganizationSchema: false, hasProductSchema: false, hasFaqSchema: false,
        hasBreadcrumbSchema: false, hasArticleSchema: false, hasWebsiteSchema: false,
        imageCount: 0, missingAltCount: 0, imagesWithAlt: 0,
        internalLinks: [], externalLinks: [], brokenNavItems: [], navItems: [],
        pageType: "other", brandColors: [], bodySnippet: "",
        canonicalIsSelf: true, canonicalMismatch: false,
        isNoindex: false, isNofollow: false,
        hasOgTitle: false, hasOgDescription: false, hasOgImage: false,
        hasMultipleH1: false, h2Count: 0, h3Count: 0,
        externalNofollowCount: 0, externalDofollowCount: 0,
        titleKeywords: [],
        hasTableOfContents: false, hasNumberedList: false, hasTable: false,
      } as PageData;
      const pd = parsePage(r.html, url, Date.now() - start, r.status);
      pd.finalUrl = r.finalUrl;
      return pd;
    }));
    pages.push(...results);
  }

  // 6. Detect languages
  const langs = new Set<string>();
  pages.forEach(p => (p.hreflang || []).forEach(h => langs.add(h.lang)));
  if (langs.size === 0) {
    // Detect from content
    const hasThaiContent = pages.some(p => /[฀-๿]/.test(p.bodySnippet || ""));
    const hasEnglishContent = pages.some(p => /[a-zA-Z]{3,}/.test(p.bodySnippet || ""));
    if (hasThaiContent) langs.add("th");
    if (hasEnglishContent) langs.add("en");
  }

  const allDiscoveredUrls = [...new Set([
    ...sitemap.urls,
    ...pages.map(p => p.url),
  ])];

  return {
    domain,
    baseUrl: base,
    hostname,
    isHttps,
    sitemap,
    robots,
    pages,
    allDiscoveredUrls,
    crawledAt: new Date().toISOString(),
    homepageData,
    languages: [...langs],
    isMultiLanguage: langs.size > 1,
    navRawItems,
  };
}
