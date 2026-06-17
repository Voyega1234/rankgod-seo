export interface ParsedInput {
  rawInput: string;
  detectedUrls: string[];
  mainArticleUrl: string | null;
  competitorUrls: string[];
  sitemapUrl: string | null;
  rawArticleText: string | null;
  rawHtml: string | null;
  detectedKeyword: string | null;
  detectedLanguage: "Thai" | "English" | "Thai/English mixed" | "Unknown";
  detectedArticleType: "Visa" | "Travel" | "Affiliate" | "Local/Service" | "General";
  websiteBaseUrl: string | null;
  confidence: number;
  warnings: string[];
}

export interface ExtractedSeo {
  url: string;
  httpStatus: number | null;
  finalUrl: string | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2s: string[];
  h3s: string[];
  schemaTypes: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  wordCount: number;
  paragraphCount: number;
  tableCount: number;
  listCount: number;
  imageCount: number;
  missingAltCount: number;
  internalLinks: Array<{ href: string; text: string }>;
  externalLinks: Array<{ href: string; text: string }>;
  nofollowLinks: string[];
  hasAuthor: boolean;
  authorName: string | null;
  hasDate: boolean;
  dateText: string | null;
  hasFaq: boolean;
  hasCtaSection: boolean;
  hasContactInfo: boolean;
  mainText: string;
  first300Words: string;
  allHeadings: string[];
  questionsFound: string[];
  repeatedPhrases: string[];
  vagueClaims: string[];
  officialSourceLinks: string[];
  lowTrustSourceLinks: string[];
  ctaPhrases: string[];
  overclaims: string[];
  errors: string[];
}

export interface ApexCategory {
  name: string;
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "warning" | "critical";
  evidence: string[];
  whyItMatters: string;
  exactFixes: string[];
  expectedImpact: string;
  difficulty: "easy" | "medium" | "hard";
  priority: number;
  confidence: number;
}

export interface ApexScore {
  total: number;
  maxTotal: number;
  verdict: string;
  categories: ApexCategory[];
}

export interface FailureReason {
  type: string;
  confidence: number;
  evidence: string[];
  impact: "high" | "medium" | "low";
  fix: string;
  effort: "easy" | "medium" | "hard";
  priority: number;
}

export interface CompetitorInsight {
  url: string;
  extracted: ExtractedSeo | null;
  scorecard: {
    wordCount: number;
    h2Count: number;
    hasFaq: boolean;
    hasTable: boolean;
    hasOfficialSources: boolean;
    titleScore: number;
  };
  whatTheyDoBetter: string[];
  whatWeLack: string[];
}

export interface AnalysisResult {
  parsed: ParsedInput;
  mainArticle: ExtractedSeo | null;
  competitors: CompetitorInsight[];
  apexScore: ApexScore;
  failureReasons: FailureReason[];
  oneSentenceTruth: string;
  finalDecision: string;
  topProblems: string[];
  topFixes: string[];
  rewriteBrief: string;
  rewritePrompt: string;
  titleOptions: string[];
  metaOptions: string[];
  h2Suggestions: string[];
  faqSuggestions: Array<{ q: string; a: string }>;
  tableSuggestions: string[];
  internalLinkOpportunities: string[];
  officialSourceSuggestions: string[];
  aiSearchFindings: {
    canExtract: string[];
    cannotExtract: string[];
    suggestedQuickAnswer: string;
    suggestedSummaryTable: string[];
  };
  freshnessRisks: string[];
  conversionIssues: string[];
  actionPlan24h: string[];
  actionPlan7d: string[];
  actionPlan14d: string[];
  actionPlan30d: string[];
  coJourneyScore: number | null;
  coJourneyChecklist: Array<{ label: string; pass: boolean; note: string }> | null;
  markdownReport: string;
  isAiEnhanced: boolean;
  warnings: string[];
}
