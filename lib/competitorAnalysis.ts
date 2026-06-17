import { ExtractedSeo, CompetitorInsight, ParsedInput } from "./types";

export function analyzeCompetitors(
  mainArticle: ExtractedSeo | null,
  competitorExtractions: Array<{ url: string; extracted: ExtractedSeo | null }>,
  parsed: ParsedInput
): CompetitorInsight[] {
  // parsed is available for future keyword-aware analysis
  void parsed;

  return competitorExtractions.map(({ url, extracted }) => {
    const whatTheyDoBetter: string[] = [];
    const whatWeLack: string[] = [];

    if (!extracted) {
      return {
        url,
        extracted: null,
        scorecard: { wordCount: 0, h2Count: 0, hasFaq: false, hasTable: false, hasOfficialSources: false, titleScore: 0 },
        whatTheyDoBetter: ["Could not fetch competitor"],
        whatWeLack: [],
      };
    }

    const myWc = mainArticle?.wordCount || 0;
    const theirWc = extracted.wordCount || 0;
    if (theirWc > myWc * 1.2) {
      whatTheyDoBetter.push(`More words (${theirWc} vs ${myWc}) — deeper coverage`);
      whatWeLack.push(`Add ~${theirWc - myWc} more words of useful content`);
    }

    if (extracted.hasFaq && !mainArticle?.hasFaq) {
      whatTheyDoBetter.push("Has FAQ section");
      whatWeLack.push("Add FAQ section");
    }

    if ((extracted.tableCount || 0) > 0 && (mainArticle?.tableCount || 0) === 0) {
      whatTheyDoBetter.push("Uses structured tables");
      whatWeLack.push("Add comparison/summary tables");
    }

    if ((extracted.officialSourceLinks || []).length > (mainArticle?.officialSourceLinks || []).length) {
      whatTheyDoBetter.push("More official source links");
      whatWeLack.push("Link to more official sources");
    }

    if ((extracted.h2s || []).length > (mainArticle?.h2s || []).length) {
      whatTheyDoBetter.push(`More H2 sections (${extracted.h2s.length} vs ${mainArticle?.h2s?.length || 0})`);
      whatWeLack.push("Expand content with more detailed H2 sections");
    }

    const titleScore = extracted.title ? Math.min(100, extracted.title.length * 2) : 0;

    return {
      url,
      extracted,
      scorecard: {
        wordCount: theirWc,
        h2Count: extracted.h2s?.length || 0,
        hasFaq: extracted.hasFaq,
        hasTable: (extracted.tableCount || 0) > 0,
        hasOfficialSources: (extracted.officialSourceLinks || []).length > 0,
        titleScore,
      },
      whatTheyDoBetter,
      whatWeLack,
    };
  });
}
