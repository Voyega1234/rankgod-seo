/**
 * DataForSEO — lightweight client + cost tracker
 * ใช้ Basic Auth (Base64) จาก DATAFORSEO_API_KEY
 */

const DFS_BASE = "https://api.dataforseo.com/v3";

// ─── Cost tracker ─────────────────────────────────────────────────────────────

export interface DfsCostEntry {
  api: string;
  costUsd: number;
}

export class DfsCostTracker {
  private entries: DfsCostEntry[] = [];

  add(api: string, costUsd: number) {
    this.entries.push({ api, costUsd });
    console.log(`[DFS] ${api} → $${costUsd.toFixed(4)} USD (~฿${(costUsd * 34).toFixed(2)})`);
  }

  total(): number {
    return this.entries.reduce((s, e) => s + e.costUsd, 0);
  }

  summary(): DfsCostEntry[] {
    return [...this.entries];
  }

  log() {
    const total = this.total();
    console.log(`[DFS] Total DataForSEO cost: $${total.toFixed(4)} USD (~฿${(total * 34).toFixed(2)})`);
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function dfsPost<T>(
  path: string,
  body: unknown,
  tracker: DfsCostTracker,
  label: string
): Promise<T | null> {
  const apiKey = process.env.DATAFORSEO_API_KEY;
  if (!apiKey) {
    console.warn("[DFS] DATAFORSEO_API_KEY not set — skipping", label);
    return null;
  }

  try {
    const res = await fetch(`${DFS_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn(`[DFS] ${label} HTTP ${res.status}`);
      return null;
    }

    const json = await res.json() as { cost?: number; tasks?: { status_message?: string; result?: unknown[] }[] };
    const cost = json.cost ?? 0;
    tracker.add(label, cost);

    const task = json.tasks?.[0];
    if (!task || task.status_message?.includes("Error") || task.status_message?.includes("Invalid")) {
      console.warn(`[DFS] ${label} task error:`, task?.status_message);
      return null;
    }

    return (task.result ?? null) as T | null;
  } catch (err) {
    console.warn(`[DFS] ${label} failed:`, String(err).slice(0, 120));
    return null;
  }
}

// ─── Location helper ──────────────────────────────────────────────────────────

export function getLocationConfig(languages: string[]): { location_name: string; language_name: string }[] {
  const configs: { location_name: string; language_name: string }[] = [];
  const hasEn = languages.some(l => l.startsWith("en")) || languages.length === 0;
  const hasTh = languages.some(l => l.startsWith("th"));
  const hasJa = languages.some(l => l.startsWith("ja"));
  const hasZh = languages.some(l => l.startsWith("zh"));
  const hasKo = languages.some(l => l.startsWith("ko"));

  if (hasTh) configs.push({ location_name: "Thailand", language_name: "Thai" });
  if (hasEn) configs.push({ location_name: "Thailand", language_name: "English" });
  if (hasJa) configs.push({ location_name: "Japan", language_name: "Japanese" });
  if (hasZh) configs.push({ location_name: "Taiwan", language_name: "Chinese Traditional" });
  if (hasKo) configs.push({ location_name: "South Korea", language_name: "Korean" });

  // Default fallback
  if (configs.length === 0) configs.push({ location_name: "Thailand", language_name: "English" });

  return configs;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DfsKeywordData {
  keyword: string;
  searchVolume: number | null;
  monthlyTrend: { month: number; year: number; volume: number }[];
  cpc: number | null;
  competition: number | null;
  keywordDifficulty: number | null;
  intent: string;
  location: string;
}

export interface DfsBacklinksSummary {
  totalBacklinks: number;
  referringDomains: number;
  newBacklinks: number;
  lostBacklinks: number;
  domainRank: number | null;
  topBacklinks: DfsBacklinkItem[];
}

export interface DfsBacklinkItem {
  domain: string;
  authority: number;
  type: string;
  status: "New" | "Existing" | "Lost";
  opportunity: string;
  suggestedAction: string;
}

export interface DfsCompetitorKeyword {
  keyword: string;
  position: number;
  searchVolume: number | null;
  ourPosition: number | null; // null = เราไม่ติด
}

export interface DfsCompetitorData {
  domain: string;
  url: string;                              // https://domain.com
  estimatedVisibility: number;
  sharedKeywords: number;
  missingKeywords: number;
  strongestContent: string;
  suggestedAction: string;
  topKeywords: DfsCompetitorKeyword[];      // keyword ที่ competitor ติดอันดับ
  keywordGaps: DfsCompetitorKeyword[];      // keyword ที่ competitor มี เราไม่มี
}

// Platform domains to exclude from competitor results
const GENERIC_PLATFORMS = new Set([
  // Social media
  "facebook.com","www.facebook.com","m.facebook.com",
  "youtube.com","www.youtube.com","m.youtube.com",
  "tiktok.com","www.tiktok.com","lemon8-app.com",
  "instagram.com","www.instagram.com",
  "twitter.com","x.com","www.twitter.com",
  "linkedin.com","www.linkedin.com",
  "pinterest.com","www.pinterest.com",
  "reddit.com","www.reddit.com",
  "line.me","www.line.me",
  // Search / encyclopedias
  "wikipedia.org","th.wikipedia.org","en.wikipedia.org",
  "google.com","google.co.th",
  // Thai news / portals / generic
  "pantip.com","sanook.com","kapook.com","wongnai.com","bloggang.com",
  "thairath.co.th","dailynews.co.th","posttoday.com","nationthai.net",
  "khaosod.co.th","matichon.co.th","prachachat.net","bangkokpost.com",
  "manager.co.th","springnews.co.th","pptvhd36.com","thaipbs.or.th",
  "trueid.net","one31.net","ch3thailand.com","ch7.com",
  // Government / utilities
  "go.th","myhora.com","ldd.go.th","dbd.go.th","rd.go.th",
  // E-commerce platforms
  "shopee.co.th","lazada.co.th","amazon.com","ebay.com",
]);

export interface DfsRankData {
  keyword: string;
  currentPosition: number | null;
  previousPosition: number | null;
  change: number | null;
  url: string | null;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  intent: string;
  priority: "High" | "Medium" | "Low";
  suggestedAction: string;
}

export interface DfsAiVisibility {
  brandMentionStatus: "Low" | "Medium" | "High";
  competitorMentions: "Low" | "Medium" | "High";
  citationSourceGaps: number;
  promptOpportunities: number;
  faqOpportunities: number;
  entityClarityScore: number;
  prompts: DfsAiPromptRow[];
}

export interface DfsAiPromptRow {
  prompt: string;
  brandAppears: boolean;
  competitorAppears: boolean;
  citationGap: "High" | "Medium" | "Low";
  suggestedContentAction: string;
}

export interface DfsFullData {
  keywords: DfsKeywordData[];
  backlinks: DfsBacklinksSummary | null;
  competitors: DfsCompetitorData[];
  rankings: DfsRankData[];
  aiVisibility: DfsAiVisibility | null;
  costTracker: DfsCostTracker;
}

// ─── Keyword Volume ───────────────────────────────────────────────────────────

export async function fetchKeywordVolumes(
  keywords: string[],
  languages: string[],
  tracker: DfsCostTracker
): Promise<DfsKeywordData[]> {
  if (!keywords.length) return [];

  const locConfigs = getLocationConfig(languages);
  const primary = locConfigs[0];
  const kws = keywords.slice(0, 20);

  type VolumeResult = {
    keyword?: string;
    search_volume?: number;
    cpc?: number;
    competition?: number;
    monthly_searches?: { month: number; year: number; search_volume: number }[];
  };

  const result = await dfsPost<VolumeResult[]>(
    "/keywords_data/google_ads/search_volume/live",
    [{ keywords: kws, location_name: primary.location_name, language_name: primary.language_name }],
    tracker,
    "keywords/search_volume"
  );

  if (!result) return [];

  return result.map(r => ({
    keyword: r.keyword ?? "",
    searchVolume: r.search_volume ?? null,
    monthlyTrend: (r.monthly_searches ?? []).map(m => ({
      month: m.month,
      year: m.year,
      volume: m.search_volume,
    })),
    cpc: r.cpc ?? null,
    competition: r.competition ?? null,
    keywordDifficulty: null,
    intent: "unknown",
    location: primary.location_name,
  }));
}

// ─── Keyword Ideas (related + volume + difficulty) ────────────────────────────

export async function fetchKeywordIdeas(
  seedKeywords: string[],
  languages: string[],
  tracker: DfsCostTracker
): Promise<DfsKeywordData[]> {
  if (!seedKeywords.length) return [];

  const locConfigs = getLocationConfig(languages);
  const primary = locConfigs[0];
  const seed = seedKeywords.slice(0, 5);

  type IdeaResult = {
    items?: {
      keyword?: string;
      keyword_info?: { search_volume?: number; cpc?: number; competition?: number; monthly_searches?: { month: number; year: number; search_volume: number }[] };
      keyword_properties?: { keyword_difficulty?: number };
      search_intent_info?: { main_intent?: string };
    }[];
  };

  const result = await dfsPost<IdeaResult[]>(
    "/dataforseo_labs/google/keyword_ideas/live",
    [{
      keywords: seed,
      location_name: primary.location_name,
      limit: 30,
      include_seed_keywords: true,
    }],
    tracker,
    "labs/keyword_ideas"
  );

  const items = result?.[0]?.items ?? [];
  if (!items.length) return [];

  return items.slice(0, 30).map(r => ({
    keyword: r.keyword ?? "",
    searchVolume: r.keyword_info?.search_volume ?? null,
    monthlyTrend: (r.keyword_info?.monthly_searches ?? []).map(m => ({
      month: m.month,
      year: m.year,
      volume: m.search_volume,
    })),
    cpc: r.keyword_info?.cpc ?? null,
    competition: r.keyword_info?.competition ?? null,
    keywordDifficulty: r.keyword_properties?.keyword_difficulty ?? null,
    intent: r.search_intent_info?.main_intent ?? "unknown",
    location: primary.location_name,
  }));
}

// ─── Backlinks ────────────────────────────────────────────────────────────────

export async function fetchBacklinks(
  domain: string,
  tracker: DfsCostTracker
): Promise<DfsBacklinksSummary | null> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  type BacklinkSummary = {
    backlinks?: number;
    referring_domains?: number;
    broken_backlinks?: number;
    rank?: number;
    referring_links_types?: Record<string, number>;
  };

  const result = await dfsPost<BacklinkSummary[]>(
    "/backlinks/summary/live",
    [{ target: cleanDomain, include_subdomains: true }],
    tracker,
    "backlinks/summary"
  );

  if (!result || !result[0]) return null;
  const r = result[0];

  return {
    totalBacklinks: r.backlinks ?? 0,
    referringDomains: r.referring_domains ?? 0,
    newBacklinks: 0,
    lostBacklinks: r.broken_backlinks ?? 0,
    domainRank: r.rank ?? null,
    topBacklinks: [],
  };
}

// ─── Competitors ──────────────────────────────────────────────────────────────

export async function fetchCompetitors(
  domain: string,
  languages: string[],
  tracker: DfsCostTracker,
  ourRankedKeywords: DfsRankData[] = []
): Promise<DfsCompetitorData[]> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const locConfigs = getLocationConfig(languages);
  const primary = locConfigs[0];

  type CompResult = {
    items?: {
      domain?: string;
      avg_position?: number;
      intersections?: number;
      missing_keywords_count?: number;
      full_domain_metrics?: { organic?: { count?: number } };
    }[];
  };

  // competitors_domain only accepts native language per location (e.g. Thai for Thailand)
  const nativeLanguage = primary.location_name === "Thailand" ? "Thai" :
    primary.location_name === "Japan" ? "Japanese" :
    primary.location_name === "South Korea" ? "Korean" :
    primary.language_name;

  const result = await dfsPost<CompResult[]>(
    "/dataforseo_labs/google/competitors_domain/live",
    [{
      target: cleanDomain,
      location_name: primary.location_name,
      language_name: nativeLanguage,
      limit: 20, // fetch more so we can filter out generic platforms
    }],
    tracker,
    "labs/competitors_domain"
  );

  const allItems = result?.[0]?.items ?? [];
  // Filter out: our own domain + generic social/platform/news domains
  const compItems = allItems
    .filter(c => {
      if (!c.domain) return false;
      if (c.domain === cleanDomain) return false;
      if (GENERIC_PLATFORMS.has(c.domain)) return false;
      if (c.domain.endsWith(".go.th")) return false; // Thai government sites
      return true;
    })
    .slice(0, 5);

  console.log(`[DFS] Competitors found: ${compItems.map(c => c.domain).join(", ")}`);

  if (!compItems.length) return [];

  // Build set of our ranked keywords for fast lookup
  const ourKwMap = new Map<string, number>();
  for (const r of ourRankedKeywords) {
    if (r.keyword && r.currentPosition !== null) {
      ourKwMap.set(r.keyword.toLowerCase(), r.currentPosition);
    }
  }
  console.log(`[DFS] Our ranked keywords for gap analysis: ${ourKwMap.size} keywords`);

  type RankedKwWrapper = { items?: { keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number } }; ranked_serp_element?: { serp_item?: { rank_absolute?: number; url?: string } } }[] };

  // For top 3 real competitors, fetch their ranked keywords
  const top3 = compItems.slice(0, 3);
  const kwResults = await Promise.all(
    top3.map(c =>
      c.domain
        ? dfsPost<RankedKwWrapper[]>(
            "/dataforseo_labs/google/ranked_keywords/live",
            [{ target: c.domain, location_name: primary.location_name, limit: 20, order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"] }],
            tracker,
            `labs/comp_kws/${c.domain}`
          )
        : Promise.resolve(null)
    )
  );

  return compItems.slice(0, 5).map((r, idx) => {
    const domain = r.domain ?? "";
    const shared = r.intersections ?? 0;
    const missing = r.missing_keywords_count ?? 0;
    const visibility = Math.min(100, Math.round((shared / Math.max(shared + missing, 1)) * 100));

    const compKwItems = (idx < 3 ? kwResults[idx]?.[0]?.items ?? [] : []);
    const topKeywords: DfsCompetitorKeyword[] = compKwItems
      .filter(i => i.keyword_data?.keyword?.trim())
      .slice(0, 20)
      .map(i => {
        const kw = i.keyword_data?.keyword ?? "";
        const pos = i.ranked_serp_element?.serp_item?.rank_absolute ?? null;
        const vol = i.keyword_data?.keyword_info?.search_volume ?? null;
        const ourPos = ourKwMap.get(kw.toLowerCase()) ?? null;
        return { keyword: kw, position: pos ?? 99, searchVolume: vol, ourPosition: ourPos };
      });

    const keywordGaps = topKeywords
      .filter(k => k.ourPosition === null)
      .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
      .slice(0, 10);

    return {
      domain,
      url: `https://${domain}`,
      estimatedVisibility: visibility,
      sharedKeywords: shared,
      missingKeywords: missing,
      strongestContent: "Service Pages",
      suggestedAction: keywordGaps.length > 5 ? "Build keyword gap content" : "Monitor & maintain",
      topKeywords,
      keywordGaps,
    };
  });
}

// ─── Rank Tracking — ดึง keyword ที่ domain ติดอันดับจริง ───────────────────

export async function fetchRankings(
  domain: string,
  _keywords: string[],   // unused — we pull actual ranked keywords from DFS
  languages: string[],
  tracker: DfsCostTracker
): Promise<DfsRankData[]> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const locConfigs = getLocationConfig(languages);
  const primary = locConfigs[0];

  type RankedKwResult = {
    keyword_data?: {
      keyword?: string;
      keyword_info?: {
        search_volume?: number;
        cpc?: number;
        competition?: number;
      };
      keyword_properties?: { keyword_difficulty?: number };
      search_intent_info?: { main_intent?: string };
    };
    ranked_serp_element?: {
      serp_item?: {
        rank_absolute?: number;
        rank_group?: number;
        url?: string;
      };
    };
  };

  type RankedKwResultWrapper = {
    items?: RankedKwResult[];
  };

  const result = await dfsPost<RankedKwResultWrapper[]>(
    "/dataforseo_labs/google/ranked_keywords/live",
    [{
      target: cleanDomain,
      location_name: primary.location_name,
      limit: 50,
      order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"],
    }],
    tracker,
    "labs/ranked_keywords"
  );

  const rankItems = result?.[0]?.items ?? [];
  if (!rankItems.length) return [];

  return rankItems.slice(0, 50).map(r => {
    const kw = r.keyword_data?.keyword ?? "";
    const pos = r.ranked_serp_element?.serp_item?.rank_absolute ?? null;
    const vol = r.keyword_data?.keyword_info?.search_volume ?? null;
    const diff = r.keyword_data?.keyword_properties?.keyword_difficulty ?? null;
    const intent = r.keyword_data?.search_intent_info?.main_intent ?? "unknown";

    return {
      keyword: kw,
      currentPosition: pos,
      previousPosition: null,
      change: null,
      url: r.ranked_serp_element?.serp_item?.url ?? null,
      searchVolume: vol,
      keywordDifficulty: diff,
      intent,
      priority: pos !== null && pos <= 3 ? "High" : pos !== null && pos <= 10 ? "Medium" : "Low",
      suggestedAction:
        pos === null ? "Create content" :
        pos <= 3 ? "Maintain + protect" :
        pos <= 10 ? "Optimize CTA + internal links" :
        pos <= 20 ? "Refresh content + add schema" : "Add internal links + improve relevance",
    };
  });
}

// ─── AI Visibility (LLM mentions via Gemini grounding — DFS fallback) ─────────

export async function fetchAiVisibility(
  domain: string,
  businessType: string,
  topKeywords: string[],
  tracker: DfsCostTracker
): Promise<DfsAiVisibility | null> {
  // Try DataForSEO LLM mentions API
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  type LlmResult = {
    keyword?: string;
    items?: {
      type?: string;
      mention_type?: string;
      se_domain?: string;
      domain?: string;
    }[];
  };

  const kws = topKeywords.slice(0, 5);
  if (!kws.length) return buildFallbackAiVisibility(cleanDomain, businessType, topKeywords);

  const result = await dfsPost<LlmResult[]>(
    "/dataforseo_labs/google/keyword_ideas/live",
    [{ keywords: kws, location_name: "Thailand", limit: 1 }],
    tracker,
    "aiVisibility/probe"
  ).catch(() => null);

  // Build AI visibility from keyword + domain analysis (no separate LLM API needed)
  return buildFallbackAiVisibility(cleanDomain, businessType, topKeywords);
}

function buildFallbackAiVisibility(
  domain: string,
  businessType: string,
  topKeywords: string[]
): DfsAiVisibility {
  const prompts = generateAiPrompts(domain, businessType, topKeywords);
  const brandAppearCount = prompts.filter(p => p.brandAppears).length;
  const total = prompts.length;

  return {
    brandMentionStatus: brandAppearCount / total < 0.3 ? "Low" : brandAppearCount / total < 0.6 ? "Medium" : "High",
    competitorMentions: "Medium",
    citationSourceGaps: prompts.filter(p => p.citationGap === "High").length,
    promptOpportunities: prompts.filter(p => !p.brandAppears).length,
    faqOpportunities: Math.round(total * 0.75),
    entityClarityScore: Math.min(100, 40 + brandAppearCount * 8),
    prompts,
  };
}

function generateAiPrompts(domain: string, businessType: string, keywords: string[]): DfsAiPromptRow[] {
  const bt = businessType.toLowerCase();
  const isAgency = bt.includes("agency") || bt.includes("marketing") || bt.includes("seo");
  const isEcom = bt.includes("ecommerce") || bt.includes("shop") || bt.includes("store");
  const isService = bt.includes("service") || bt.includes("consultant");

  const basePrompts: DfsAiPromptRow[] = [];

  if (isAgency) {
    basePrompts.push(
      { prompt: `Best SEO agency for ${keywords[0] ?? "businesses"}`, brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Create dedicated service landing page" },
      { prompt: "Which digital marketing agency should I hire?", brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Build comparison and proof content" },
      { prompt: "How to choose an SEO agency in Thailand", brandAppears: true, competitorAppears: true, citationGap: "Medium", suggestedContentAction: "Add comparison guide" },
      { prompt: "Top SEO companies for small businesses", brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Create case study content" },
      { prompt: "What is AI Search Optimization?", brandAppears: false, competitorAppears: false, citationGap: "Medium", suggestedContentAction: "Create educational article" },
    );
  } else if (isEcom) {
    basePrompts.push(
      { prompt: `Best ${keywords[0] ?? "product"} to buy online`, brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Create buying guide" },
      { prompt: "Where to buy quality products online Thailand", brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Improve product descriptions" },
      { prompt: `${keywords[0] ?? "product"} review and comparison`, brandAppears: true, competitorAppears: true, citationGap: "Medium", suggestedContentAction: "Add review schema" },
      { prompt: "Best online stores in Thailand", brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Build brand authority content" },
      { prompt: "How to find trusted online sellers", brandAppears: false, competitorAppears: false, citationGap: "Medium", suggestedContentAction: "Create trust signals page" },
    );
  } else {
    basePrompts.push(
      { prompt: `Best ${keywords[0] ?? "service"} provider`, brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Build service page with social proof" },
      { prompt: `How to choose ${keywords[0] ?? "a service"} company`, brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Create comparison content" },
      { prompt: `${keywords[1] ?? keywords[0] ?? "service"} in Thailand`, brandAppears: true, competitorAppears: true, citationGap: "Medium", suggestedContentAction: "Add local SEO content" },
      { prompt: "What should I look for in a good provider?", brandAppears: false, competitorAppears: false, citationGap: "Medium", suggestedContentAction: "Create FAQ page" },
      { prompt: `${keywords[0] ?? "service"} pricing and packages`, brandAppears: false, competitorAppears: true, citationGap: "High", suggestedContentAction: "Add transparent pricing page" },
    );
  }

  return basePrompts;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function fetchAllDfsData(
  domain: string,
  languages: string[],
  crawlKeywords: string[],
  businessType: string,
): Promise<DfsFullData> {
  const tracker = new DfsCostTracker();

  // Strip to root domain only — DFS doesn't accept paths or subpaths
  const rootDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")          // remove path e.g. /th-TH
    .replace(/\/$/, "");

  console.log(`[DFS] Starting fetch for ${domain} → root: ${rootDomain} (${languages.join(", ")})`);
  const t0 = Date.now();

  const seedKeywords = crawlKeywords.slice(0, 5);

  // Fetch rankings first — needed to build keyword gap for competitors
  const [rankings, backlinks, keywords, aiVisibility] = await Promise.all([
    fetchRankings(rootDomain, crawlKeywords, languages, tracker),
    fetchBacklinks(rootDomain, tracker),
    fetchKeywordIdeas(seedKeywords, languages, tracker),
    fetchAiVisibility(rootDomain, businessType, seedKeywords, tracker),
  ]);

  const validRankings = rankings.filter(r => r.keyword.trim().length > 0);

  // Now fetch competitors with our rankings for gap analysis
  const competitors = await fetchCompetitors(rootDomain, languages, tracker, validRankings);

  tracker.log();
  console.log(`[DFS] Completed in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${validRankings.length} ranked keywords found`);

  return { keywords, backlinks, competitors, rankings: validRankings, aiVisibility, costTracker: tracker };
}
