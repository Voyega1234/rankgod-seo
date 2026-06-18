import { NextRequest, NextResponse } from "next/server";
import { parseUniversalInput } from "@/lib/parseUniversalInput";
import { fetchPage } from "@/lib/fetchPage";
import { extractSeo } from "@/lib/extractSeo";
import { computeApexScore } from "@/lib/scoring";
import { runRuleAnalysis } from "@/lib/ruleAnalysis";
import { analyzeCompetitors } from "@/lib/competitorAnalysis";
import { runAIAnalysis } from "@/lib/ai";
import { generateMarkdownReport, generateRewritePrompt } from "@/lib/report";
import { isSafeInput } from "@/lib/safety";
import type { AnalysisResult } from "@/lib/types";

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/db");
    return prisma;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    if (!isSafeInput(input)) {
      return NextResponse.json({ error: "Input contains disallowed patterns" }, { status: 400 });
    }

    // 1. Parse input
    const parsed = parseUniversalInput(input);

    // 2. Fetch main article
    let mainArticle = null;
    const fetchErrors: string[] = [];

    if (parsed.mainArticleUrl) {
      const fetched = await fetchPage(parsed.mainArticleUrl);
      if (fetched.html) {
        mainArticle = extractSeo(fetched.html, parsed.mainArticleUrl);
        mainArticle.httpStatus = fetched.status;
        mainArticle.finalUrl = fetched.finalUrl;
        mainArticle.url = parsed.mainArticleUrl;
      } else if (parsed.rawArticleText) {
        // Fetch failed but user pasted article text — use that
        const wrapped = `<html><body>${parsed.rawArticleText}</body></html>`;
        mainArticle = extractSeo(wrapped, parsed.mainArticleUrl || "");
        mainArticle.url = parsed.mainArticleUrl || "";
        fetchErrors.push(`⚠ Could not fetch URL directly (site may block bots) — analyzing pasted text instead.`);
      } else {
        fetchErrors.push(`⚠ Could not fetch this URL (site may block bots). Paste the article text together with the URL for full AI analysis.`);
      }
    } else if (parsed.rawHtml) {
      mainArticle = extractSeo(parsed.rawHtml, "");
    } else if (parsed.rawArticleText) {
      const wrapped = `<html><body>${parsed.rawArticleText}</body></html>`;
      mainArticle = extractSeo(wrapped, "");
    }

    // Infer keyword — URL slug is most reliable, then H1/title
    if (!parsed.detectedKeyword) {
      const urlSlug = parsed.mainArticleUrl
        ? parsed.mainArticleUrl.split("/").filter(Boolean).pop()?.replace(/-/g, " ").replace(/\.(html|php|aspx)$/i, "").trim()
        : null;
      const inferredKeyword =
        urlSlug ||
        mainArticle?.h1 ||
        mainArticle?.title?.replace(/[-|–—].*$/, "").trim();
      if (inferredKeyword && inferredKeyword.length < 80) {
        parsed.detectedKeyword = inferredKeyword;
        parsed.warnings.push(`Keyword inferred from URL: "${inferredKeyword}"`);
      }
    }

    // Update article type from content
    if (mainArticle && parsed.detectedArticleType === "General") {
      const text = (mainArticle.mainText || "").toLowerCase();
      if (/visa|วีซ่า|embassy|schengen/.test(text)) parsed.detectedArticleType = "Visa";
      else if (/travel|เที่ยว|hotel|flight/.test(text)) parsed.detectedArticleType = "Travel";
    }

    // 3. Fetch competitors
    const competitorExtractions: Array<{ url: string; extracted: ReturnType<typeof extractSeo> | null }> = [];
    for (const compUrl of parsed.competitorUrls.slice(0, 3)) {
      const fetched = await fetchPage(compUrl);
      if (fetched.html) {
        const ext = extractSeo(fetched.html, compUrl);
        competitorExtractions.push({ url: compUrl, extracted: ext });
      } else {
        fetchErrors.push(`Could not fetch competitor ${compUrl}: ${fetched.error}`);
        competitorExtractions.push({ url: compUrl, extracted: null });
      }
    }

    // 4. Competitor analysis
    const competitors = analyzeCompetitors(mainArticle, competitorExtractions, parsed);

    // 5. Apex score
    const apexScore = computeApexScore(mainArticle, parsed, competitors);

    // 6. Rule analysis
    const ruleResult = runRuleAnalysis(mainArticle, parsed, competitors);

    // 7. AI enhancement
    let aiResult: Partial<AnalysisResult> = {};
    if (process.env.GEMINI_API_KEY) {
      aiResult = await runAIAnalysis(parsed, mainArticle, ruleResult, competitors);
    }

    // 8. Merge
    const merged: AnalysisResult = {
      parsed,
      mainArticle,
      competitors,
      apexScore,
      failureReasons: ruleResult.failureReasons,
      oneSentenceTruth: aiResult.oneSentenceTruth || ruleResult.oneSentenceTruth,
      finalDecision: ruleResult.finalDecision,
      topProblems: aiResult.topProblems || ruleResult.topProblems,
      topFixes: aiResult.topFixes || ruleResult.topFixes,
      rewriteBrief: aiResult.rewriteBrief || ruleResult.rewriteBrief,
      rewritePrompt: "",
      titleOptions: aiResult.titleOptions || ruleResult.titleOptions,
      metaOptions: aiResult.metaOptions || ruleResult.metaOptions,
      h2Suggestions: aiResult.h2Suggestions || ruleResult.h2Suggestions,
      faqSuggestions: aiResult.faqSuggestions || ruleResult.faqSuggestions,
      tableSuggestions: ruleResult.tableSuggestions,
      internalLinkOpportunities: ruleResult.internalLinkOpportunities,
      officialSourceSuggestions: ruleResult.officialSourceSuggestions,
      aiSearchFindings: ruleResult.aiSearchFindings,
      freshnessRisks: ruleResult.freshnessRisks,
      conversionIssues: ruleResult.conversionIssues,
      actionPlan24h: ruleResult.actionPlan24h,
      actionPlan7d: ruleResult.actionPlan7d,
      actionPlan14d: ruleResult.actionPlan14d,
      actionPlan30d: ruleResult.actionPlan30d,
      coJourneyScore: ruleResult.coJourneyScore ?? null,
      coJourneyChecklist: ruleResult.coJourneyChecklist ?? null,
      markdownReport: "",
      isAiEnhanced: !!aiResult.isAiEnhanced,
      warnings: [...parsed.warnings, ...fetchErrors],
    };

    merged.rewritePrompt = generateRewritePrompt(merged);
    merged.markdownReport = generateMarkdownReport(merged);

    // 9. Save to DB
    try {
      const db = await getPrisma();
      if (db) {
        await db.scan.create({
          data: {
            rawInput: input.slice(0, 5000),
            detectedMainUrl: parsed.mainArticleUrl,
            detectedKeyword: parsed.detectedKeyword,
            detectedArticleType: parsed.detectedArticleType,
            detectedLanguage: parsed.detectedLanguage,
            score: apexScore.total,
            verdict: apexScore.verdict,
            finalDecision: merged.finalDecision,
            markdownReport: merged.markdownReport,
            jsonReport: JSON.stringify({ apexScore, failureReasons: merged.failureReasons }),
            rewritePrompt: merged.rewritePrompt,
          },
        });
      }
    } catch (dbErr) {
      console.error("DB save failed:", dbErr);
    }

    return NextResponse.json(merged);
  } catch (err: unknown) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
