import { AnalysisResult } from "./types";
import { COMPLIANCE_NOTE } from "./safety";

export function generateMarkdownReport(result: AnalysisResult): string {
  const { parsed, mainArticle, apexScore, failureReasons, oneSentenceTruth, finalDecision, topProblems, topFixes, rewriteBrief, rewritePrompt, titleOptions, metaOptions, h2Suggestions, faqSuggestions, tableSuggestions, internalLinkOpportunities, officialSourceSuggestions, aiSearchFindings, freshnessRisks, conversionIssues, actionPlan24h, coJourneyChecklist } = result;

  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  return `# RankGod Local Report

**URL:** ${parsed.mainArticleUrl || "N/A (text input)"}
**Keyword:** ${parsed.detectedKeyword || "Inferred from content"}
**Date:** ${date}
**Article Type:** ${parsed.detectedArticleType}
**Language:** ${parsed.detectedLanguage}
**Score:** ${apexScore.total}/${apexScore.maxTotal}
**Verdict:** ${apexScore.verdict}
**Final Decision:** ${finalDecision}

---

## 1. The One-Sentence Truth

${oneSentenceTruth}

---

## 2. Why This Page Is Not Winning

${failureReasons.slice(0, 5).map((r, i) => `${i + 1}. **${r.type}** (${r.impact} impact)\n   ${r.evidence.join(", ")}\n   Fix: ${r.fix}`).join("\n\n")}

---

## 3. Top 5 Problems

${topProblems.map((p, i) => `${i + 1}. ${p}`).join("\n")}

---

## 4. Top 5 Fixes To Do First

${topFixes.map((f, i) => `${i + 1}. ${f}`).join("\n")}

---

## 5. Apex Score Breakdown

${apexScore.categories.map(c => `### ${c.name}: ${c.score}/${c.maxScore} (${c.status.toUpperCase()})
- Evidence: ${c.evidence.join("; ")}
- Fix: ${c.exactFixes.join("; ")}
- Impact: ${c.expectedImpact}`).join("\n\n")}

---

## 6. Search Intent Diagnosis

Article type detected: **${parsed.detectedArticleType}**
Language: **${parsed.detectedLanguage}**
${mainArticle?.h1 ? `Current H1: "${mainArticle.h1}"` : "No H1 detected"}
${parsed.detectedKeyword ? `Target keyword: "${parsed.detectedKeyword}"` : ""}

---

## 7. Content Depth Diagnosis

- Word count: ${mainArticle?.wordCount || 0}
- H2 sections: ${mainArticle?.h2s.length || 0}
- Has FAQ: ${mainArticle?.hasFaq ? "Yes" : "No"}
- Has tables: ${(mainArticle?.tableCount || 0) > 0 ? "Yes" : "No"}
- Has checklist/lists: ${(mainArticle?.listCount || 0) > 0 ? "Yes" : "No"}

${rewriteBrief}

---

## 8. Competitor Insights

${result.competitors.length === 0 ? "No competitor URLs were provided. Add competitor URLs to get gap analysis." : result.competitors.map(c => `### ${c.url}
- Word count: ${c.extracted?.wordCount || "N/A"}
- Has FAQ: ${c.extracted?.hasFaq ? "Yes" : "No"}
- What they do better: ${c.whatTheyDoBetter.join(", ") || "Unknown"}
- What we lack: ${c.whatWeLack.join(", ") || "Nothing detected"}`).join("\n\n")}

---

## 9. Trust / E-E-A-T Issues

- Author: ${mainArticle?.hasAuthor ? mainArticle.authorName || "Detected" : "Not detected"}
- Date: ${mainArticle?.hasDate ? mainArticle.dateText || "Detected" : "Not detected"}
- Official sources: ${(mainArticle?.officialSourceLinks || []).length}
- Overclaims: ${(mainArticle?.overclaims || []).join(", ") || "None detected"}

---

## 10. Internal Link Opportunities

${internalLinkOpportunities.length > 0 ? internalLinkOpportunities.map((l, i) => `${i + 1}. ${l}`).join("\n") : "Add internal links to related content on your site"}

---

## 11. AI Search Understanding

**Can extract:**
${aiSearchFindings.canExtract.map(e => `- ${e}`).join("\n")}

**Cannot confidently extract:**
${aiSearchFindings.cannotExtract.map(e => `- ${e}`).join("\n")}

**Suggested Quick Answer:**
${aiSearchFindings.suggestedQuickAnswer}

---

## 12. Freshness Risks

${freshnessRisks.length > 0 ? freshnessRisks.map(r => `- ${r}`).join("\n") : "- No major freshness risks detected"}

---

## 13. Conversion Issues

${conversionIssues.length > 0 ? conversionIssues.map(i => `- ${i}`).join("\n") : "- Conversion path looks adequate"}

---

## 14. Rewrite To Win

${rewriteBrief}

---

## 15. Suggested Title Options

${titleOptions.map((t, i) => `${i + 1}. ${t}`).join("\n")}

---

## 16. Suggested Meta Descriptions

${metaOptions.map((m, i) => `${i + 1}. ${m}`).join("\n")}

---

## 17. Suggested H1/H2/H3 Structure

${h2Suggestions.map((h, i) => `${i + 1}. ${h}`).join("\n")}

---

## 18. Suggested FAQ

${faqSuggestions.map((f, i) => `**Q${i + 1}: ${f.q}**\n${f.a}`).join("\n\n")}

---

## 19. Suggested Tables / Checklists

${tableSuggestions.map((t, i) => `${i + 1}. ${t}`).join("\n")}

---

## 20. Suggested Internal Links

${internalLinkOpportunities.map((l, i) => `${i + 1}. ${l}`).join("\n")}

---

## 21. Suggested Official Sources

${officialSourceSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}

---

## 22. 24-Hour Action Plan

${actionPlan24h.map((a, i) => `${i + 1}. ${a}`).join("\n")}

---

## 23. Compliance / White-Hat Note

${COMPLIANCE_NOTE}
`;
}

export function generateRewritePrompt(result: AnalysisResult): string {
  const { parsed, mainArticle, apexScore, topProblems, h2Suggestions, faqSuggestions } = result;

  return `You are an expert SEO content writer. Please rewrite the following article to rank on Page 1 of Google.

ARTICLE DETAILS:
- URL: ${parsed.mainArticleUrl || "Text input"}
- Target keyword: ${parsed.detectedKeyword || "Inferred from content"}
- Article type: ${parsed.detectedArticleType}
- Language: ${parsed.detectedLanguage}
- Current score: ${apexScore.total}/100
- Current verdict: ${apexScore.verdict}

MAIN PROBLEMS TO FIX:
${topProblems.map((p, i) => `${i + 1}. ${p}`).join("\n")}

REQUIRED STRUCTURE:
${h2Suggestions.map((h, i) => `${i + 1}. ${h}`).join("\n")}

REQUIRED FAQ (include these questions with direct answers):
${faqSuggestions.slice(0, 5).map(f => `- ${f.q}`).join("\n")}

WRITING RULES:
- Answer the keyword question in the first 150 words
- Use clear H2/H3 hierarchy
- Include a comparison/summary table
- Include a numbered checklist or step-by-step section
- Add FAQ section with 5+ questions
- Include author name and last-updated date
- ${parsed.detectedArticleType === "Visa" || parsed.detectedArticleType === "Travel" ? "Link to official government/embassy sources for facts" : "Support claims with credible sources"}
- ${parsed.detectedLanguage === "Thai" || parsed.detectedLanguage === "Thai/English mixed" ? "Write in clear Thai with practical, reader-first tone" : "Write in clear, helpful English"}
- No overclaims, no guarantees, no exaggerated promises
- End with a soft, helpful CTA

CURRENT ARTICLE (to be rewritten):
${mainArticle?.mainText?.slice(0, 3000) || parsed.rawArticleText?.slice(0, 3000) || "No article text available — please paste article content"}

Please rewrite this article following all the rules above to achieve Page 1 rankings.`;
}
