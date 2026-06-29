/**
 * Site Audit — orchestrates crawler → scorer → AI analyzer → DataForSEO
 */
import { crawlSite } from "./crawler";
import { scoreSite } from "./scorer";
import { runAiAnalysis } from "./aiAnalyzer";
import { fetchAllDfsData, type DfsFullData } from "./dataForSeo";
import { buildKeywordFrequencyMap } from "./aiAnalyzer";
import type { CrawlData } from "./crawler";
import type { ScorerResult, SeoScores, SeoIssue } from "./scorer";
import type { AiSeoAnalysis } from "./aiAnalyzer";

// ─── Public types ─────────────────────────────────────────────────────────────

export type { SeoScores, SeoIssue, AiSeoAnalysis };
export type { CrawlData };
export type { DfsFullData };

export interface CostSummary {
  geminiModel: string;
  geminiInputTokens: number;
  geminiOutputTokens: number;
  geminiCostUsd: number;
  dfsCostUsd: number;
  totalCostUsd: number;
  totalCostThb: number;
  dfsBreakdown: { api: string; costUsd: number }[];
}

export interface SiteAuditResult {
  domain: string;
  baseUrl: string;
  isHttps: boolean;
  crawledAt: string;
  pageCount: number;
  discoveredUrlCount: number;
  brandColors: string[];
  sitemap: {
    found: boolean;
    url: string | null;
    urlCount: number;
    status: number | null;
    sitemapDeclared: boolean;
  };
  robots: {
    found: boolean;
    disallowedPaths: string[];
  };
  scores: SeoScores;
  issues: {
    critical: SeoIssue[];
    high: SeoIssue[];
    medium: SeoIssue[];
    low: SeoIssue[];
  };
  strengths: string[];
  sitemapRecommended: ScorerResult["sitemapRecommended"];
  aiAnalysis: AiSeoAnalysis | null;
  dfsData: DfsFullData | null;
  costSummary: CostSummary | null;
  languages: string[];
  isMultiLanguage: boolean;
  navItems: string[];
  topPages: Array<{
    url: string;
    type: string;
    title: string | null;
    h1: string | null;
    metaDescription: string | null;
    wordCount: number;
    schemas: string[];
    internalLinks: number;
    missingAlt: number;
    status: number | null;
  }>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runSiteAudit(domain: string, model?: string): Promise<SiteAuditResult> {
  // 1. Crawl
  const crawlData: CrawlData = await crawlSite(domain);
  const pages = crawlData.pages.filter(p => p.status === 200);

  // 2. Score + issues
  const scored: ScorerResult = scoreSite(crawlData);

  // 3. Extract top keywords from crawl data for DFS
  const topKeywords = buildKeywordFrequencyMap(pages)
    .slice(0, 10)
    .map(k => k.keyword)
    .filter(k => k.length >= 3);

  // 4. Run AI + DataForSEO in parallel
  const [aiResult, dfsData] = await Promise.all([
    runAiAnalysis(crawlData, scored, model),
    fetchAllDfsData(
      crawlData.domain,
      crawlData.languages,
      topKeywords,
      pages.find(p => p.pageType === "home")?.title ?? ""
    ).catch(err => {
      console.warn("[siteAudit] DFS fetch failed:", String(err).slice(0, 100));
      return null;
    }),
  ]);

  if (!aiResult) {
    throw new Error("AI วิเคราะห์ไม่สำเร็จ — กรุณาลอง scan ใหม่อีกครั้ง");
  }

  // 5. Build cost summary
  const geminiCostUsd = (aiResult as AiSeoAnalysis & { _costUsd?: number })._costUsd ?? 0;
  const dfsCostUsd = dfsData?.costTracker.total() ?? 0;
  const totalCostUsd = geminiCostUsd + dfsCostUsd;

  const costSummary: CostSummary = {
    geminiModel: model ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    geminiInputTokens: (aiResult as AiSeoAnalysis & { _inputTokens?: number })._inputTokens ?? 0,
    geminiOutputTokens: (aiResult as AiSeoAnalysis & { _outputTokens?: number })._outputTokens ?? 0,
    geminiCostUsd,
    dfsCostUsd,
    totalCostUsd,
    totalCostThb: totalCostUsd * 34,
    dfsBreakdown: dfsData?.costTracker.summary() ?? [],
  };

  console.log(
    `[siteAudit] Total scan cost: $${totalCostUsd.toFixed(4)} USD (~฿${(totalCostUsd * 34).toFixed(2)}) | ` +
    `Gemini: $${geminiCostUsd.toFixed(4)} | DFS: $${dfsCostUsd.toFixed(4)}`
  );

  // 6. Build top pages list
  const pageTypeScore = (type: string) => {
    if (type === "home") return 100;
    if (type === "category") return 80;
    if (type === "collection") return 78;
    if (type === "product") return 70;
    if (type === "service") return 65;
    if (type === "about") return 60;
    if (type === "contact") return 50;
    if (type === "blog") return 40;
    if (type === "faq") return 35;
    if (type === "podcast") return 15;
    return 10;
  };

  const sorted = crawlData.pages
    .filter(p => p.status === 200 || p.status === null)
    .sort((a, b) => {
      const typeDiff = pageTypeScore(b.pageType) - pageTypeScore(a.pageType);
      if (typeDiff !== 0) return typeDiff;
      const linkDiff = b.internalLinks.length - a.internalLinks.length;
      if (linkDiff !== 0) return linkDiff;
      return b.wordCount - a.wordCount;
    });

  const seenSignature = new Map<string, number>();
  const deduped = sorted.filter(p => {
    const sig = `${p.pageType}:${p.wordCount}:${p.internalLinks.length}`;
    const count = seenSignature.get(sig) ?? 0;
    if (count >= 3) return false;
    seenSignature.set(sig, count + 1);
    return true;
  });

  const topPages = deduped.slice(0, 40).map(p => ({
    url: p.url,
    type: p.pageType,
    title: p.title,
    h1: p.h1,
    metaDescription: p.metaDescription,
    wordCount: p.wordCount,
    schemas: p.schemas.map(s => s.type),
    internalLinks: p.internalLinks.length,
    missingAlt: p.missingAltCount,
    status: p.status,
  }));

  const brandColors = crawlData.pages[0]?.brandColors?.slice(0, 5) || [];

  return {
    domain: crawlData.domain,
    baseUrl: crawlData.baseUrl,
    isHttps: crawlData.isHttps,
    crawledAt: crawlData.crawledAt,
    pageCount: crawlData.pages.length,
    discoveredUrlCount: crawlData.allDiscoveredUrls.length,
    brandColors,
    sitemap: {
      found: crawlData.sitemap.found,
      url: crawlData.sitemap.url,
      urlCount: crawlData.sitemap.urlCount,
      status: crawlData.sitemap.status,
      sitemapDeclared: crawlData.robots.sitemapDeclared,
    },
    robots: {
      found: crawlData.robots.found,
      disallowedPaths: crawlData.robots.disallowedPaths,
    },
    scores: scored.scores,
    issues: scored.issues,
    strengths: scored.strengths,
    sitemapRecommended: scored.sitemapRecommended,
    aiAnalysis: aiResult,
    dfsData,
    costSummary,
    languages: crawlData.languages,
    isMultiLanguage: crawlData.isMultiLanguage,
    navItems: crawlData.navRawItems,
    topPages,
  };
}
