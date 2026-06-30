/**
 * Vertex AI Grounding with Google Search
 * Runs real-time Google Search queries to enrich competitor + keyword intelligence
 * before the main AI analysis pass.
 *
 * Auth:
 *   Vercel OIDC → Google Workload Identity Federation → service account impersonation
 *
 * Required env vars:
 *   GCP_PROJECT_ID                      — your Google Cloud project ID
 *   GCP_LOCATION                        — Vertex AI region (default: us-central1)
 *   GCP_PROJECT_NUMBER
 *   GCP_SERVICE_ACCOUNT_EMAIL
 *   GCP_WORKLOAD_IDENTITY_POOL_ID
 *   GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
 */

import { Tool } from "@google-cloud/vertexai";
import { getVertexAI, hasVertexOidcConfig } from "./vertexOidc";

export interface GroundingResult {
  competitors: {
    domain: string;
    name: string;
    snippet: string;
  }[];
  keywordInsights: {
    keyword: string;
    serpContext: string;
  }[];
  marketContext: string;
  groundingSources: string[];
}

// ─── Vertex AI client (lazy-init per call — serverless safe) ─────────────────

async function groundedQuery(
  prompt: string
): Promise<{ text: string; sources: string[] }> {
  const vertex = getVertexAI();
  const model = vertex.getGenerativeModel({
    model: process.env.GEMINI_VERTEX_MODEL || "gemini-2.0-flash-001",
    tools: [{ googleSearch: {} } as Tool],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Extract grounding source URLs from metadata
  const sources: string[] = [];
  const groundingMeta = response.candidates?.[0]?.groundingMetadata;
  if (groundingMeta) {
    // groundingChunks contains the retrieved search results
    const chunks = (groundingMeta as Record<string, unknown>).groundingChunks as Array<{
      web?: { uri?: string; title?: string };
    }> | undefined;
    if (chunks) {
      for (const chunk of chunks) {
        if (chunk.web?.uri) sources.push(chunk.web.uri);
      }
    }
  }

  return { text, sources };
}

// ─── Parse competitor domains from grounding response text ────────────────────

function parseCompetitors(text: string, ownDomain: string): GroundingResult["competitors"] {
  const competitors: GroundingResult["competitors"] = [];
  const seen = new Set<string>();

  // Match domain-like patterns from the text
  const domainPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2})?)/g;
  const lines = text.split("\n").filter(l => l.trim());

  for (const line of lines) {
    let match;
    while ((match = domainPattern.exec(line)) !== null) {
      const domain = match[1].toLowerCase();
      if (
        domain === ownDomain ||
        domain.includes("google") ||
        domain.includes("facebook") ||
        domain.includes("wikipedia") ||
        seen.has(domain)
      ) continue;
      seen.add(domain);
      // Use the surrounding line as snippet
      competitors.push({
        domain,
        name: domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1),
        snippet: line.trim().slice(0, 200),
      });
      if (competitors.length >= 5) break;
    }
    if (competitors.length >= 5) break;
  }

  return competitors;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runGroundingResearch(
  domain: string,
  topKeywords: string[],
  businessContext: string,
  language: string
): Promise<GroundingResult | null> {
  if (!hasVertexOidcConfig()) {
    console.log("[grounding] Vertex OIDC env vars not set — skipping grounding");
    return null;
  }

  const kw = topKeywords.slice(0, 5).join(", ");
  const lang = language || "Thai";
  const allSources: string[] = [];

  try {
    // ── Query 1: Find real competitors in the same market ──
    const competitorQuery = `Who are the top SEO competitors of ${domain} in ${lang} market? ` +
      `This website is about: ${businessContext}. ` +
      `List 5 competing websites with their domains that rank for similar keywords: ${kw}. ` +
      `Focus on websites in Thailand or ${lang}-language market.`;

    console.log("[grounding] Searching competitors...");
    const compResult = await groundedQuery(competitorQuery);
    allSources.push(...compResult.sources);

    // ── Query 2: Keyword SERP context for top keywords ──
    const keywordQuery = `Search intent and competition level in Thailand/Thai market for these SEO keywords: ${kw}. ` +
      `For each keyword, describe: who is currently ranking, what type of content ranks (blog/product/service page), ` +
      `and the approximate competition level (low/medium/high).`;

    console.log("[grounding] Searching keyword SERP context...");
    const kwResult = await groundedQuery(keywordQuery);
    allSources.push(...kwResult.sources);

    // ── Query 3: Market/industry context ──
    const marketQuery = `What is the current SEO and digital marketing landscape for "${businessContext}" in Thailand in 2025? ` +
      `What are the main challenges and opportunities for a website like ${domain}?`;

    console.log("[grounding] Searching market context...");
    const marketResult = await groundedQuery(marketQuery);
    allSources.push(...marketResult.sources);

    // ── Parse competitors from response ──
    const competitors = parseCompetitors(compResult.text, domain);

    // ── Parse keyword insights ──
    const keywordInsights = topKeywords.slice(0, 5).map((kw, i) => ({
      keyword: kw,
      serpContext: kwResult.text.split("\n").filter(l =>
        l.toLowerCase().includes(kw.toLowerCase())
      )[0]?.trim() || kwResult.text.split("\n")[i]?.trim() || "",
    })).filter(k => k.serpContext);

    // Deduplicate sources
    const uniqueSources = [...new Set(allSources)].slice(0, 10);

    console.log(`[grounding] Done — ${competitors.length} competitors, ${keywordInsights.length} keyword insights, ${uniqueSources.length} sources`);

    return {
      competitors,
      keywordInsights,
      marketContext: marketResult.text.slice(0, 800),
      groundingSources: uniqueSources,
    };
  } catch (err) {
    console.error("[grounding] Research failed:", String(err).slice(0, 200));
    return null;
  }
}
