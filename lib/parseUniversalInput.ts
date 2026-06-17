import { ParsedInput } from "./types";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
const THAI_REGEX = /[฀-๿]/;
const ENGLISH_ALPHA_REGEX = /[a-zA-Z]/;

const VISA_KEYWORDS = /visa|วีซ่า|embassy|consulate|schengen|เอกสารยื่นวีซ่า|ยื่นวีซ่า|วีซ่า/i;
const TRAVEL_KEYWORDS = /travel|เที่ยว|ท่องเที่ยว|flight|hotel|itinerary|ท่องเที่ยว|ที่พัก|สายการบิน/i;
const AFFILIATE_KEYWORDS = /review|รีวิว|ซื้อ|ราคา|product|affiliate|สินค้า|แนะนำ|เปรียบเทียบ/i;
const SERVICE_KEYWORDS = /service|contact|phone|line|booking|บริการ|ติดต่อ|โทร|จอง|ราคาบริการ/i;

export function parseUniversalInput(input: string): ParsedInput {
  const warnings: string[] = [];
  const trimmed = input.trim();

  // Detect URLs
  const urlMatches = trimmed.match(URL_REGEX) || [];
  const detectedUrls = [...new Set(urlMatches.map(u => u.replace(/[.,;:!?)]+$/, "")))];

  // Classify URLs
  let mainArticleUrl: string | null = null;
  let sitemapUrl: string | null = null;
  const competitorUrls: string[] = [];

  for (const url of detectedUrls) {
    if (url.toLowerCase().includes("sitemap")) {
      sitemapUrl = url;
    } else if (!mainArticleUrl) {
      mainArticleUrl = url;
    } else {
      competitorUrls.push(url);
    }
  }

  // Detect if input contains HTML
  const hasHtmlTags = /<\s*(html|head|body|article|div|h[1-6]|p|section)\b/i.test(trimmed);
  const rawHtml = hasHtmlTags ? trimmed : null;
  // Extract text even when URL is present (user may paste URL + article body together)
  const textWithoutUrls = trimmed.replace(URL_REGEX, "").trim();
  const rawArticleText = !hasHtmlTags && textWithoutUrls.length > 150 ? textWithoutUrls : null;

  // Detect keyword
  let detectedKeyword: string | null = null;
  const keywordMatch = trimmed.match(/(?:keyword|คีย์เวิร์ด|keywords?)\s*:\s*(.+?)(?:\n|$)/i);
  if (keywordMatch) {
    detectedKeyword = keywordMatch[1].trim();
  }

  // Detect language
  const thaiChars = (trimmed.match(/[฀-๿]/g) || []).length;
  const engChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
  let detectedLanguage: ParsedInput["detectedLanguage"] = "Unknown";
  if (thaiChars > 0 && engChars > 0) {
    detectedLanguage = thaiChars > engChars * 0.5 ? "Thai/English mixed" : "English";
  } else if (thaiChars > 10) {
    detectedLanguage = "Thai";
  } else if (engChars > 10) {
    detectedLanguage = "English";
  }

  // Detect article type
  let detectedArticleType: ParsedInput["detectedArticleType"] = "General";
  const textToCheck = trimmed + (mainArticleUrl || "");
  if (VISA_KEYWORDS.test(textToCheck)) {
    detectedArticleType = "Visa";
  } else if (TRAVEL_KEYWORDS.test(textToCheck)) {
    detectedArticleType = "Travel";
  } else if (AFFILIATE_KEYWORDS.test(textToCheck)) {
    detectedArticleType = "Affiliate";
  } else if (SERVICE_KEYWORDS.test(textToCheck)) {
    detectedArticleType = "Local/Service";
  }

  // Infer base URL
  let websiteBaseUrl: string | null = null;
  if (mainArticleUrl) {
    try {
      const u = new URL(mainArticleUrl);
      websiteBaseUrl = `${u.protocol}//${u.hostname}`;
    } catch {}
  }

  // Confidence
  let confidence = 50;
  if (detectedUrls.length > 0) confidence += 20;
  if (detectedKeyword) confidence += 15;
  if (rawHtml) confidence += 10;
  if (rawArticleText) confidence += 10;
  confidence = Math.min(confidence, 95);

  if (!mainArticleUrl && !rawHtml && !rawArticleText) {
    warnings.push("No URL, HTML, or article text detected. Please paste a URL or article content.");
    confidence = 10;
  }

  return {
    rawInput: trimmed,
    detectedUrls,
    mainArticleUrl,
    competitorUrls,
    sitemapUrl,
    rawArticleText,
    rawHtml,
    detectedKeyword,
    detectedLanguage,
    detectedArticleType,
    websiteBaseUrl,
    confidence,
    warnings,
  };
}
