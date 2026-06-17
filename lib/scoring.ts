import { ApexScore, ApexCategory, ExtractedSeo, ParsedInput, CompetitorInsight } from "./types";

function makeCategory(
  name: string,
  score: number,
  maxScore: number,
  status: ApexCategory["status"],
  evidence: string[],
  whyItMatters: string,
  exactFixes: string[],
  expectedImpact: string,
  difficulty: ApexCategory["difficulty"],
  priority: number,
  confidence: number
): ApexCategory {
  return { name, score, maxScore, status, evidence, whyItMatters, exactFixes, expectedImpact, difficulty, priority, confidence };
}

export function computeApexScore(
  article: ExtractedSeo | null,
  parsed: ParsedInput,
  competitors: CompetitorInsight[]
): ApexScore {
  const categories: ApexCategory[] = [];

  // 1. Crawl & Index Clarity (7)
  {
    let score = 7;
    const evidence: string[] = [];
    const fixes: string[] = [];

    if (!article?.title) { score -= 3; evidence.push("Missing <title> tag"); fixes.push("Add a descriptive title tag with your primary keyword"); }
    if (!article?.h1) { score -= 2; evidence.push("Missing H1"); fixes.push("Add a single clear H1 with primary keyword"); }
    if (article?.metaRobots?.includes("noindex")) { score = 0; evidence.push("Meta robots: noindex — page is blocked from Google"); fixes.push("Remove noindex unless intentional"); }
    if (article?.canonicalUrl && article.finalUrl && !article.canonicalUrl.includes(new URL(article.finalUrl).hostname)) {
      score -= 2; evidence.push("Canonical points to different domain"); fixes.push("Fix canonical URL to point to this page");
    }

    const status = score >= 6 ? "excellent" : score >= 4 ? "good" : score >= 2 ? "warning" : "critical";
    categories.push(makeCategory("Crawl & Index Clarity", Math.max(0, score), 7, status, evidence.length ? evidence : ["No critical crawl issues detected"], whyItMatters_crawl, fixes.length ? fixes : ["Maintain clean crawl signals"], "High impact on whether Google finds and indexes the page", "easy", 1, 85));
  }

  // 2. Technical SEO Foundation (7)
  {
    let score = 7;
    const evidence: string[] = [];
    const fixes: string[] = [];

    if (!article?.metaDescription) { score -= 2; evidence.push("Missing meta description"); fixes.push("Write a 150–160 char meta description with keyword and CTA"); }
    if ((article?.schemaTypes || []).length === 0) { score -= 2; evidence.push("No schema markup detected"); fixes.push("Add Article, FAQ, BreadcrumbList schema JSON-LD"); }
    if (article?.missingAltCount && article.missingAltCount > 3) { score -= 1; evidence.push(`${article.missingAltCount} images missing alt text`); fixes.push("Add descriptive alt text to all images"); }
    if (!article?.ogTitle) { score -= 1; evidence.push("Missing Open Graph title"); fixes.push("Add og:title and og:description meta tags"); }

    const status = score >= 6 ? "excellent" : score >= 4 ? "good" : score >= 2 ? "warning" : "critical";
    categories.push(makeCategory("Technical SEO Foundation", Math.max(0, score), 7, status, evidence.length ? evidence : ["Technical basics look good"], "Technical signals help Google understand and display your content", fixes.length ? fixes : ["Review schema markup for completeness"], "Moderate but lasting impact", "medium", 2, 80));
  }

  // 3. Search Intent Match (12)
  {
    let score = 12;
    const evidence: string[] = [];
    const fixes: string[] = [];

    const keyword = parsed.detectedKeyword?.toLowerCase() || "";
    const title = article?.title?.toLowerCase() || "";
    const h1 = article?.h1?.toLowerCase() || "";

    if (keyword && title && !title.includes(keyword) && !keyword.includes(title.split(" ")[0])) {
      score -= 4; evidence.push("Keyword not found in title"); fixes.push(`Include "${parsed.detectedKeyword}" in title`);
    }
    if (keyword && h1 && !h1.includes(keyword)) {
      score -= 3; evidence.push("Keyword not in H1"); fixes.push(`Include keyword in H1`);
    }
    if ((article?.wordCount || 0) < 300) {
      score -= 3; evidence.push("Very short content — may not satisfy intent"); fixes.push("Expand content to at least 800+ words");
    }

    const status = score >= 10 ? "excellent" : score >= 7 ? "good" : score >= 4 ? "warning" : "critical";
    categories.push(makeCategory("Search Intent Match", Math.max(0, score), 12, status, evidence.length ? evidence : ["Content appears to match search intent"], "Intent mismatch is the #1 silent ranking killer", fixes.length ? fixes : ["Continue aligning content with searcher needs"], "Very high — directly affects ranking position", "medium", 1, 75));
  }

  // 4. Content Depth & Usefulness (12)
  {
    let score = 12;
    const evidence: string[] = [];
    const fixes: string[] = [];

    const wc = article?.wordCount || 0;
    const avgCompetitorWc = competitors.length > 0
      ? competitors.reduce((sum, c) => sum + (c.extracted?.wordCount || 0), 0) / competitors.length
      : 0;

    if (wc < 800) { score -= 4; evidence.push(`Only ${wc} words — likely thin content`); fixes.push("Expand to 1,200+ words with detailed sections"); }
    if (avgCompetitorWc > 0 && wc < avgCompetitorWc * 0.6) { score -= 3; evidence.push(`Word count ${wc} is 40%+ below competitors (avg ${Math.round(avgCompetitorWc)})`); fixes.push(`Add ${Math.round(avgCompetitorWc * 0.8 - wc)} more words to match competitor depth`); }
    if (article?.tableCount === 0) { score -= 1; evidence.push("No tables detected"); fixes.push("Add comparison/summary tables"); }
    if (!article?.hasFaq) { score -= 2; evidence.push("No FAQ section"); fixes.push("Add 5–8 FAQ questions with concise answers"); }
    if ((article?.h2s || []).length < 3) { score -= 2; evidence.push("Fewer than 3 H2 sections"); fixes.push("Structure content with 5–8 H2 sections"); }

    const status = score >= 10 ? "excellent" : score >= 7 ? "good" : score >= 4 ? "warning" : "critical";
    categories.push(makeCategory("Content Depth & Usefulness", Math.max(0, score), 12, status, evidence.length ? evidence : ["Content depth appears reasonable"], "Google rewards the most useful, comprehensive answer", fixes.length ? fixes : ["Add more depth, examples, and structured data"], "High — directly affects topical authority", "hard", 2, 80));
  }

  // 5. Competitor Defense (10)
  {
    let score = 10;
    const evidence: string[] = [];
    const fixes: string[] = [];

    if (competitors.length === 0) {
      score = 5; evidence.push("No competitor URLs provided — cannot fully assess"); fixes.push("Add competitor URLs to get competitive gap analysis");
    } else {
      const compFaqs = competitors.filter(c => c.extracted?.hasFaq).length;
      const myFaq = article?.hasFaq;
      if (compFaqs > 0 && !myFaq) { score -= 3; evidence.push("Competitors have FAQ but you don't"); fixes.push("Add FAQ section matching competitor questions"); }

      const compTables = competitors.filter(c => (c.extracted?.tableCount || 0) > 0).length;
      if (compTables > 0 && (article?.tableCount || 0) === 0) { score -= 2; evidence.push("Competitors use tables; you don't"); fixes.push("Add structured tables to your content"); }
    }

    const status = score >= 8 ? "excellent" : score >= 6 ? "good" : score >= 4 ? "warning" : "critical";
    categories.push(makeCategory("Competitor Defense", Math.max(0, score), 10, status, evidence.length ? evidence : ["Competitive position looks adequate"], "To win, you must do what competitors do AND do it better", fixes.length ? fixes : ["Regularly audit competitor content for new gaps"], "High — determines if you can beat existing rankings", "hard", 3, 70));
  }

  // 6. E-E-A-T / Trust (12)
  {
    let score = 12;
    const evidence: string[] = [];
    const fixes: string[] = [];

    if (!article?.hasAuthor) { score -= 3; evidence.push("No author detected"); fixes.push("Add clear author name and bio"); }
    if (!article?.hasDate) { score -= 2; evidence.push("No date/update date found"); fixes.push("Add publication and last-updated date"); }
    if ((article?.officialSourceLinks || []).length === 0 && (parsed.detectedArticleType === "Visa" || parsed.detectedArticleType === "Travel")) {
      score -= 4; evidence.push("No official sources for visa/travel content"); fixes.push("Link to official embassy/government sources");
    }
    if ((article?.overclaims || []).length > 0) { score -= 3; evidence.push(`Overclaims detected: ${article?.overclaims.join(", ")}`); fixes.push("Remove or soften guarantee language"); }

    const status = score >= 10 ? "excellent" : score >= 7 ? "good" : score >= 4 ? "warning" : "critical";
    categories.push(makeCategory("E-E-A-T / Trust / Source Quality", Math.max(0, score), 12, status, evidence.length ? evidence : ["Trust signals appear adequate"], "Google's quality raters penalize low-trust YMYL content", fixes.length ? fixes : ["Continuously build author authority"], "Very high for YMYL topics like visa/health/finance", "medium", 2, 80));
  }

  // 7. Internal Link Power (9)
  {
    let score = 9;
    const evidence: string[] = [];
    const fixes: string[] = [];

    const internalCount = (article?.internalLinks || []).length;
    if (internalCount === 0) { score -= 5; evidence.push("No internal links detected"); fixes.push("Add 3–5 contextual internal links to related content"); }
    else if (internalCount < 3) { score -= 2; evidence.push(`Only ${internalCount} internal links`); fixes.push("Add more internal links with descriptive anchor text"); }

    const weakAnchors = (article?.internalLinks || []).filter(l => /click here|read more|here|link/i.test(l.text));
    if (weakAnchors.length > 2) { score -= 2; evidence.push("Multiple weak anchor texts (click here, read more)"); fixes.push("Replace generic anchors with keyword-rich descriptive text"); }

    const status = score >= 7 ? "excellent" : score >= 5 ? "good" : score >= 3 ? "warning" : "critical";
    categories.push(makeCategory("Internal Link Power", Math.max(0, score), 9, status, evidence.length ? evidence : ["Internal linking appears healthy"], "Internal links distribute PageRank and help Google understand site structure", fixes.length ? fixes : ["Build pillar/cluster link structure"], "Medium — amplifies other pages while boosting this one", "easy", 3, 75));
  }

  // 8. CTR / SERP Snippet Power (6)
  {
    let score = 6;
    const evidence: string[] = [];
    const fixes: string[] = [];

    const title = article?.title || "";
    const meta = article?.metaDescription || "";

    if (!title) { score -= 3; evidence.push("No title"); fixes.push("Create compelling title with keyword + differentiator"); }
    else if (title.length > 60) { score -= 1; evidence.push(`Title too long (${title.length} chars)`); fixes.push("Shorten title to under 60 characters"); }
    else if (title.length < 20) { score -= 1; evidence.push("Title very short"); fixes.push("Expand title to include keyword and value prop"); }

    if (!meta) { score -= 2; evidence.push("No meta description"); fixes.push("Write 150–160 char meta description with CTA"); }
    else if (meta.length > 160) { score -= 1; evidence.push("Meta description too long — will be truncated"); fixes.push("Shorten meta to 150–160 characters"); }

    const status = score >= 5 ? "excellent" : score >= 3 ? "good" : score >= 2 ? "warning" : "critical";
    categories.push(makeCategory("CTR / SERP Snippet Power", Math.max(0, score), 6, status, evidence.length ? evidence : ["Snippet elements look clickable"], "CTR affects rankings — better snippets get more clicks", fixes.length ? fixes : ["A/B test title/meta variations"], "Medium — affects how many people click even if you rank", "easy", 2, 85));
  }

  // 9. AI Search Extractability (8)
  {
    let score = 8;
    const evidence: string[] = [];
    const fixes: string[] = [];

    if (!article?.hasFaq) { score -= 2; evidence.push("No FAQ for AI to extract"); fixes.push("Add FAQ with direct Q&A format"); }
    if (article?.tableCount === 0) { score -= 1; evidence.push("No structured tables"); fixes.push("Add summary/comparison tables AI can cite"); }
    if ((article?.questionsFound || []).length < 2) { score -= 2; evidence.push("Few questions answered"); fixes.push("Answer 5+ specific user questions directly"); }
    if (!article?.first300Words.includes("?") && (article?.first300Words.length || 0) > 100) {
      score -= 1; evidence.push("No direct answer near top of article"); fixes.push("Add a 1–2 sentence direct answer in the first 150 words");
    }

    const status = score >= 7 ? "excellent" : score >= 5 ? "good" : score >= 3 ? "warning" : "critical";
    categories.push(makeCategory("AI Search Extractability", Math.max(0, score), 8, status, evidence.length ? evidence : ["Content is reasonably extractable by AI"], "AI Overviews and AI search cite pages with clear, structured answers", fixes.length ? fixes : ["Maintain direct, structured answers throughout"], "High — AI Search is increasingly important for visibility", "medium", 2, 70));
  }

  // 10. Freshness / Decay Risk (5)
  {
    let score = 5;
    const evidence: string[] = [];
    const fixes: string[] = [];

    const text = article?.mainText || "";
    const oldYears = text.match(/\b(201[0-9]|202[0-2])\b/g) || [];
    if (oldYears.length > 2) { score -= 2; evidence.push(`Old years found: ${[...new Set(oldYears)].join(", ")}`); fixes.push("Update outdated year references and facts"); }
    if (!article?.hasDate) { score -= 2; evidence.push("No publication/update date visible"); fixes.push("Display last-updated date prominently"); }

    const status = score >= 4 ? "excellent" : score >= 3 ? "good" : score >= 2 ? "warning" : "critical";
    categories.push(makeCategory("Freshness / Decay Risk", Math.max(0, score), 5, status, evidence.length ? evidence : ["Content appears reasonably fresh"], "Google prefers fresh content for time-sensitive queries", fixes.length ? fixes : ["Schedule quarterly content reviews"], "Medium — prevents ranking decay over time", "easy", 3, 70));
  }

  // 11. Conversion Path Quality (5)
  {
    let score = 5;
    const evidence: string[] = [];
    const fixes: string[] = [];

    if (!article?.hasCtaSection) { score -= 2; evidence.push("No CTA detected"); fixes.push("Add a clear, contextual CTA section"); }
    if (!article?.hasContactInfo && parsed.detectedArticleType === "Local/Service") { score -= 3; evidence.push("Service page with no contact info"); fixes.push("Add phone, email, LINE, or booking link prominently"); }

    const status = score >= 4 ? "excellent" : score >= 3 ? "good" : score >= 2 ? "warning" : "critical";
    categories.push(makeCategory("Conversion Path Quality", Math.max(0, score), 5, status, evidence.length ? evidence : ["Conversion path looks adequate"], "Traffic that doesn't convert wastes your SEO investment", fixes.length ? fixes : ["Test CTA placement and messaging"], "Medium — improves business value of rankings", "medium", 3, 65));
  }

  // 12. Cannibalization Risk (5)
  {
    const score = 5;
    const evidence = ["No sitemap provided — cannibalization check requires sitemap or multiple article URLs"];
    const fixes = ["Provide sitemap URL to detect potential keyword cannibalization"];
    categories.push(makeCategory("Cannibalization Risk Control", score, 5, "good", evidence, "Duplicate keyword targeting splits your ranking power", fixes, "Medium — consolidating cannibalizing pages can double rankings", "medium", 4, 40));
  }

  // 13. Topical Authority Fit (2)
  {
    const score = 1;
    const evidence = ["Topical authority requires full site analysis"];
    const fixes = ["Build content clusters around your main topics"];
    categories.push(makeCategory("Topical Authority Fit", score, 2, "warning", evidence, "Google ranks sites that dominate a topic, not just one page", fixes, "Long-term — foundational to sustained rankings", "hard", 5, 30));
  }

  const total = categories.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = categories.reduce((sum, c) => sum + c.maxScore, 0);

  let verdict = "Rewrite / Merge / Noindex Candidate";
  if (total >= 97) verdict = "Apex Weapon";
  else if (total >= 93) verdict = "Unfair Advantage";
  else if (total >= 88) verdict = "Page-One Contender";
  else if (total >= 80) verdict = "Strong but Beatable";
  else if (total >= 70) verdict = "Needs Strategic Upgrade";
  else if (total >= 60) verdict = "Vulnerable";
  else if (total >= 40) verdict = "Competitors Are Winning";

  return { total, maxTotal, verdict, categories };
}

const whyItMatters_crawl = "If Google can't crawl and index your page, nothing else matters — you literally don't exist in search results";
