import * as cheerio from "cheerio";
import { ExtractedSeo } from "./types";

const OVERCLAIM_PATTERNS = [
  /การันตีวีซ่า/i, /ผ่านแน่นอน/i, /100%/i, /ไม่มีพลาด/i,
  /guarantee.*visa/i, /100% success/i, /definitely approved/i,
];

const VAGUE_PATTERNS = [
  /\bsome\b|\bmany\b|\bvarious\b|\bseveral\b/gi,
  /บางส่วน|หลายๆ|ต่างๆ|บางครั้ง/g,
];

const OFFICIAL_DOMAINS = /\.gov|\.go\.th|\.gouv|embassy|consulate|mfa\.|mofa\.|schengenvisainfo/i;

export function extractSeo(html: string, baseUrl: string = ""): ExtractedSeo {
  const $ = cheerio.load(html);

  // Remove scripts/styles
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const metaRobots = $('meta[name="robots"]').attr("content")?.trim() || null;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;

  const h1 = $("h1").first().text().trim() || null;
  const h2s = $("h2").map((_, el) => $(el).text().trim()).get();
  const h3s = $("h3").map((_, el) => $(el).text().trim()).get();

  // Schema types
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "{}");
      if (data["@type"]) schemaTypes.push(data["@type"]);
      if (Array.isArray(data["@graph"])) {
        data["@graph"].forEach((item: { "@type"?: string }) => {
          if (item["@type"]) schemaTypes.push(item["@type"]);
        });
      }
    } catch {}
  });

  // Word count
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const words = bodyText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const paragraphCount = $("p").length;
  const tableCount = $("table").length;
  const listCount = $("ul, ol").length;
  const imageCount = $("img").length;
  const missingAltCount = $("img:not([alt]), img[alt='']").length;

  // Links
  const internalLinks: Array<{ href: string; text: string }> = [];
  const externalLinks: Array<{ href: string; text: string }> = [];
  const nofollowLinks: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    const rel = $(el).attr("rel") || "";

    if (rel.includes("nofollow")) nofollowLinks.push(href);

    if (href.startsWith("http")) {
      const isInternal = baseUrl && href.includes(new URL(baseUrl).hostname);
      if (isInternal) {
        internalLinks.push({ href, text });
      } else {
        externalLinks.push({ href, text });
      }
    } else if (href.startsWith("/") || href.startsWith("#")) {
      internalLinks.push({ href, text });
    }
  });

  // Author detection
  const authorEl = $('[rel="author"], .author, [class*="author"], [itemprop="author"]').first();
  const authorName = authorEl.text().trim() || null;
  const hasAuthor = !!authorName;

  // Date detection
  const dateEl = $("time, [itemprop='datePublished'], [itemprop='dateModified'], .date, [class*='date']").first();
  const dateText = dateEl.attr("datetime") || dateEl.text().trim() || null;
  const hasDate = !!dateText;

  // FAQ detection
  const hasFaq = /faq|คำถาม|ถามตอบ|frequently asked/i.test(bodyText) ||
    $("[itemtype*='FAQPage'], .faq").length > 0 ||
    h2s.some(h => /faq|คำถาม/i.test(h));

  // CTA detection
  const ctaPhrases = ["contact us", "get started", "book now", "apply now", "ติดต่อ", "สอบถาม", "จอง", "สมัคร"].filter(
    phrase => bodyText.toLowerCase().includes(phrase.toLowerCase())
  );
  const hasCtaSection = ctaPhrases.length > 0;

  // Contact info
  const hasPhone = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|0[689]\d{8}/.test(bodyText);
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(bodyText);
  const hasLine = /line|ไลน์|@[a-z0-9_]+/i.test(bodyText);
  const hasContactInfo = hasPhone || hasEmail || hasLine;

  // Main text (first 300 words)
  const first300Words = words.slice(0, 300).join(" ");
  const mainText = bodyText.slice(0, 10000);

  // Headings
  const allHeadings = [h1, ...h2s, ...h3s].filter(Boolean) as string[];

  // Questions
  const questionRegex = /[^.!?]*\?/g;
  const questionsFound = (bodyText.match(questionRegex) || [])
    .map(q => q.trim())
    .filter(q => q.length > 10 && q.length < 200)
    .slice(0, 10);

  // Repeated phrases (simple bigram frequency)
  const repeatedPhrases: string[] = [];
  const phraseMap = new Map<string, number>();
  const wordList = bodyText.split(/\s+/);
  for (let i = 0; i < wordList.length - 2; i++) {
    const phrase = `${wordList[i]} ${wordList[i + 1]}`.toLowerCase();
    if (phrase.length > 5) {
      phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
    }
  }
  for (const [phrase, count] of phraseMap.entries()) {
    if (count >= 5) repeatedPhrases.push(phrase);
  }

  // Overclaims
  const overclaims: string[] = [];
  for (const pattern of OVERCLAIM_PATTERNS) {
    if (pattern.test(bodyText)) {
      overclaims.push(pattern.source.replace(/[/\\^$*+?.()|[\]{}]/g, ""));
    }
  }

  // Official sources
  const officialSourceLinks: string[] = [];
  const lowTrustSourceLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (OFFICIAL_DOMAINS.test(href)) {
      officialSourceLinks.push(href);
    }
  });

  const errors: string[] = [];

  return {
    url: baseUrl,
    httpStatus: null,
    finalUrl: null,
    canonicalUrl,
    metaRobots,
    title,
    metaDescription,
    h1,
    h2s,
    h3s,
    schemaTypes,
    ogTitle,
    ogDescription,
    wordCount,
    paragraphCount,
    tableCount,
    listCount,
    imageCount,
    missingAltCount,
    internalLinks,
    externalLinks,
    nofollowLinks,
    hasAuthor,
    authorName,
    hasDate,
    dateText,
    hasFaq,
    hasCtaSection,
    hasContactInfo,
    mainText,
    first300Words,
    allHeadings,
    questionsFound,
    repeatedPhrases: repeatedPhrases.slice(0, 10),
    vagueClaims: [],
    officialSourceLinks,
    lowTrustSourceLinks,
    ctaPhrases,
    overclaims,
    errors,
  };
}
