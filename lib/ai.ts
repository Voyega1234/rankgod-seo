import { z } from "zod";
import { AnalysisResult, ParsedInput, ExtractedSeo, CompetitorInsight } from "./types";
import { getGeminiModel, getVertexResponseText, hasVertexOidcConfig } from "./vertexOidc";

// ─── Schema ───────────────────────────────────────────────────────────────────

const GodSchema = z.object({
  oneSentenceTruth: z.string(),
  topProblems: z.array(z.string()).min(3).max(5),
  topFixes: z.array(z.string()).min(3).max(5),
  rewriteBrief: z.array(z.string()).min(6).max(12),
  titleOptions: z.array(z.string()).min(5).max(7),
  metaOptions: z.array(z.string()).min(3).max(5),
  h2Suggestions: z.array(z.string()).min(6).max(10),
  faqSuggestions: z.array(z.object({ q: z.string(), a: z.string() })).min(4).max(8),
  aiInsight: z.string().optional().default(""),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fixControlChars(jsonStr: string): string {
  let inStr = false, esc = false, out = "";
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

function extractJson(raw: string): unknown {
  const clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const start = clean.indexOf("{");
  if (start === -1) throw new Error("No JSON found in response");

  // Find the last valid closing brace (handles truncated responses)
  let end = clean.lastIndexOf("}");
  if (end === -1) {
    // JSON was truncated — try to recover by closing open structures
    const partial = clean.slice(start);
    const fixed = fixControlChars(partial);
    // Count open brackets/braces to close them
    let braces = 0, brackets = 0, inStr2 = false, esc2 = false;
    for (const ch of fixed) {
      if (esc2) { esc2 = false; continue; }
      if (ch === "\\") { esc2 = true; continue; }
      if (ch === '"') { inStr2 = !inStr2; continue; }
      if (!inStr2) {
        if (ch === "{") braces++;
        else if (ch === "}") braces--;
        else if (ch === "[") brackets++;
        else if (ch === "]") brackets--;
      }
    }
    // Trim trailing incomplete string or key-value pair
    const trimmed = fixed.replace(/,?\s*"[^"]*$/, "").replace(/,?\s*"[^"]*":\s*"[^"]*$/, "");
    const closing = "]".repeat(Math.max(0, brackets)) + "}".repeat(Math.max(1, braces));
    return JSON.parse(trimmed + closing);
  }

  const jsonStr = clean.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    const fixed = fixControlChars(jsonStr);
    try {
      return JSON.parse(fixed);
    } catch {
      // Last resort: truncate at last complete key-value pair and close
      const trimmed = fixed.replace(/,?\s*"[^"]*":\s*"[^"]*$/, "").replace(/,?\s*"[^"]*$/, "");
      const closed = trimmed.endsWith("}") ? trimmed : trimmed + "}";
      return JSON.parse(closed);
    }
  }
}

function buildContext(article: ExtractedSeo | null, parsed: ParsedInput, competitors: CompetitorInsight[]): string {
  const kw = parsed.detectedKeyword || "unknown keyword";
  const body = article?.mainText?.slice(0, 4000) || article?.first300Words || "(no content available)";

  const compSection = competitors.filter(c => c.extracted).map((c, i) => {
    const e = c.extracted!;
    return `[Competitor ${i + 1}] ${c.url}
  Title: ${e.title || "N/A"} | Words: ${e.wordCount} | H2s: ${e.h2s.length} | FAQ: ${e.hasFaq}
  H2s: ${e.h2s.slice(0, 6).join(" / ")}
  Beats us on: ${c.whatTheyDoBetter.slice(0, 3).join("; ") || "unknown"}`;
  }).join("\n\n") || "No competitor data provided.";

  return `━━━ TARGET ARTICLE ━━━
URL: ${parsed.mainArticleUrl || "text input"}
PRIMARY KEYWORD: "${kw}"
Language: ${parsed.detectedLanguage} | Type: ${parsed.detectedArticleType}

METADATA:
  Title tag: ${article?.title || "MISSING"}
  Meta description: ${article?.metaDescription || "MISSING"}
  H1: ${article?.h1 || "MISSING"}
  H2s (${article?.h2s.length || 0}): ${article?.h2s.join(" / ") || "NONE"}
  Word count: ${article?.wordCount || 0}
  Tables: ${article?.tableCount || 0} | Lists: ${article?.listCount || 0} | Images: ${article?.imageCount || 0}
  FAQ section: ${article?.hasFaq ? "YES" : "NO"}
  Author: ${article?.hasAuthor ? (article.authorName || "detected") : "MISSING"}
  Date: ${article?.hasDate ? (article.dateText || "detected") : "MISSING"}
  Schema types: ${article?.schemaTypes.join(", ") || "NONE"}
  Internal links: ${article?.internalLinks.length || 0}
  Official sources: ${article?.officialSourceLinks.join(", ") || "NONE"}
  Vague claims: ${article?.vagueClaims.join("; ") || "none"}
  Overclaims: ${article?.overclaims.join("; ") || "none"}

ARTICLE BODY (up to 4000 chars):
${body}

━━━ COMPETITORS ━━━
${compSection}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runAIAnalysis(
  parsed: ParsedInput,
  article: ExtractedSeo | null,
  ruleResult: Partial<AnalysisResult>,
  competitors: CompetitorInsight[] = []
): Promise<Partial<AnalysisResult>> {
  if (!hasVertexOidcConfig()) return {};

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const isThai = parsed.detectedLanguage === "Thai" || parsed.detectedLanguage === "Thai/English mixed";
  const lang = isThai ? "Thai" : "English";
  const kw = parsed.detectedKeyword || "this topic";
  const ctx = buildContext(article, parsed, competitors);

  const SYSTEM = `You are the world's most elite SEO analyst — 20 years of experience ranking competitive keywords across 50+ industries.
You have the forensic precision of a data scientist and the strategic instinct of a growth hacker.
You think in specifics, not generalities. Every output must be immediately usable — copy-paste ready.
LANGUAGE RULE: Respond entirely in ${lang}. If ${lang} is Thai, write ALL output in Thai including JSON values.
JSON OUTPUT RULES (CRITICAL — violations break the parser):
- Output a single valid JSON object. No text before or after it.
- No markdown code fences (no \`\`\`json).
- Every string value MUST be on a single line. NEVER put a literal newline inside a JSON string value. Use a space or semicolon instead of newline when you want to separate sentences within a string.
- Do not use curly quotes (" ") or smart apostrophes. Use only straight ASCII quotes and apostrophes.`;

  const USER = `You are analyzing an article targeting the keyword: "${kw}"

${ctx}

RULE-BASED ISSUES ALREADY DETECTED:
${(ruleResult.topProblems || []).map((p, i) => `${i + 1}. ${p}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR MISSION: GOD-TIER SEO ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Produce an analysis so sharp and specific that a writer can rewrite this article to rank #1 WITHOUT any additional research.

ABSOLUTE RULES — breaking any = useless output:
1. oneSentenceTruth: Must name a specific flaw visible in the actual content above. No "the article lacks depth" — say WHAT is missing and WHY it matters for THIS keyword.
2. topProblems: Each must cite specific evidence from the article above (quote titles, count words, name missing sections). No generic SEO problems.
3. topFixes: Each must be an exact action — "Add H2: [exact heading text]" not "Add more H2s". "Change title to: [exact new title]" not "Improve the title".
4. rewriteBrief: Bullet list, 8–10 bullets. Must be specific enough that a freelance writer can execute it without asking ANY follow-up questions. Include target word count, exact angle, exact tone, 3 must-include facts/sections, and 2 must-avoid patterns.
5. titleOptions: Each title must contain "${kw}" or a close semantic variant. Each must be a complete, publish-ready title — not a template.
6. metaOptions: Each meta must be complete and publish-ready (under 155 chars). Must contain "${kw}". Must start with an action verb or question.
7. h2Suggestions: Each H2 must be a complete heading a writer would actually use — specific to "${kw}", not generic like "Overview" or "Introduction".
8. faqSuggestions: Questions must be real queries people type into Google about "${kw}". Answers must contain a specific fact, number, or step — not vague generalities.
9. aiInsight: The ONE insight that separates a Page 1 article from a Page 3 article for "${kw}" — something a rule-based system could never detect. Must be specific and actionable.

Return ONLY this JSON object:
{
  "oneSentenceTruth": "...",
  "topProblems": ["...", "...", "...", "...", "..."],
  "topFixes": ["...", "...", "...", "...", "..."],
  "rewriteBrief": [
    "Keyword: ${kw}",
    "Target: [X] words",
    "Angle: [exact differentiating angle for ${kw}]",
    "Tone: [exact tone — e.g. practical, authoritative, conversational]",
    "Must include: [specific section or fact #1 that top-ranking pages have]",
    "Must include: [specific section or fact #2]",
    "Must include: [specific section or fact #3]",
    "Must include: [specific section or fact #4]",
    "Avoid: [specific pattern #1 that hurts ranking for ${kw}]",
    "Avoid: [specific pattern #2]"
  ],
  "titleOptions": [
    "Publish-ready title with ${kw} — option 1",
    "Option 2 — question format",
    "Option 3 — year + benefit",
    "Option 4 — number list",
    "Option 5 — comparison/vs",
    "Option 6 — long-tail",
    "Option 7 — local/specific"
  ],
  "metaOptions": [
    "Complete meta description #1 (under 155 chars)",
    "Complete meta #2",
    "Complete meta #3",
    "Complete meta #4",
    "Complete meta #5"
  ],
  "h2Suggestions": [
    "Specific H2 heading #1",
    "Specific H2 heading #2",
    "Specific H2 heading #3",
    "Specific H2 heading #4",
    "Specific H2 heading #5",
    "Specific H2 heading #6",
    "Specific H2 heading #7",
    "Specific H2 heading #8"
  ],
  "faqSuggestions": [
    {"q": "Real Google query about ${kw} #1", "a": "Specific factual answer with number or step"},
    {"q": "Real query #2", "a": "Specific answer"},
    {"q": "Real query #3", "a": "Specific answer"},
    {"q": "Real query #4", "a": "Specific answer"},
    {"q": "Real query #5", "a": "Specific answer"},
    {"q": "Real query #6", "a": "Specific answer"}
  ],
  "aiInsight": "The single most important non-obvious strategic insight for ranking '${kw}'"
}`;

  try {
    const model = getGeminiModel({
      model: modelName,
      systemInstruction: SYSTEM,
      generationConfig: { maxOutputTokens: 4500, temperature: 0.3 },
    });
    const result = await model.generateContent(USER);
    const raw = getVertexResponseText(result.response);
    if (!raw) return {};


    const jsonData = extractJson(raw) as Record<string, unknown>;

    // Normalize rewriteBrief — Claude may return string or array
    if (typeof jsonData.rewriteBrief === "string") {
      jsonData.rewriteBrief = (jsonData.rewriteBrief as string)
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);
    }

    const parsed_ai = GodSchema.parse(jsonData);

    return {
      oneSentenceTruth: parsed_ai.oneSentenceTruth,
      topProblems: parsed_ai.topProblems,
      topFixes: parsed_ai.topFixes,
      rewriteBrief: parsed_ai.rewriteBrief.map(b => `• ${b.replace(/^[•\-]\s*/, "")}`).join("\n"),
      titleOptions: parsed_ai.titleOptions,
      metaOptions: parsed_ai.metaOptions,
      h2Suggestions: parsed_ai.h2Suggestions,
      faqSuggestions: parsed_ai.faqSuggestions,
      isAiEnhanced: true,
    };
  } catch (err) {
    console.error("AI analysis failed:", err);
    return {};
  }
}
