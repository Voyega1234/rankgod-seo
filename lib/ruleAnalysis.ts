import { ExtractedSeo, ParsedInput, FailureReason, CompetitorInsight } from "./types";

export function runRuleAnalysis(
  article: ExtractedSeo | null,
  parsed: ParsedInput,
  competitors: CompetitorInsight[]
): {
  failureReasons: FailureReason[];
  topProblems: string[];
  topFixes: string[];
  oneSentenceTruth: string;
  finalDecision: string;
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
  rewriteBrief: string;
  actionPlan24h: string[];
  actionPlan7d: string[];
  actionPlan14d: string[];
  actionPlan30d: string[];
  coJourneyScore: number | null;
  coJourneyChecklist: Array<{ label: string; pass: boolean; note: string }> | null;
} {
  const failures: FailureReason[] = [];
  const keyword = parsed.detectedKeyword || "";
  const isThai = parsed.detectedLanguage === "Thai" || parsed.detectedLanguage === "Thai/English mixed";
  const isVisa = parsed.detectedArticleType === "Visa";
  const isTravel = parsed.detectedArticleType === "Travel";
  const isService = parsed.detectedArticleType === "Local/Service";

  // --- Failure detection ---
  if (!article?.title) {
    failures.push({ type: "Missing Title Tag", confidence: 99, evidence: ["<title> tag is absent"], impact: "high", fix: "Add a keyword-rich title tag under 60 characters", effort: "easy", priority: 1 });
  }
  if (!article?.h1) {
    failures.push({ type: "Missing H1", confidence: 99, evidence: ["No H1 heading found"], impact: "high", fix: "Add one clear H1 with your primary keyword", effort: "easy", priority: 1 });
  }
  if (article?.wordCount && article.wordCount < 800) {
    failures.push({ type: "Thin Content", confidence: 90, evidence: [`Only ${article.wordCount} words`], impact: "high", fix: "Expand to at least 1,000+ words with practical, useful content", effort: "hard", priority: 2 });
  }
  if (!article?.hasFaq) {
    failures.push({ type: "No FAQ Section", confidence: 85, evidence: ["No FAQ detected"], impact: "medium", fix: "Add 5–8 FAQ questions covering common user questions", effort: "medium", priority: 2 });
  }
  if ((article?.internalLinks || []).length === 0) {
    failures.push({ type: "No Internal Links", confidence: 95, evidence: ["Zero internal links found"], impact: "medium", fix: "Add 3–5 internal links to related articles on your site", effort: "easy", priority: 2 });
  }
  if (!article?.hasAuthor) {
    failures.push({ type: "Missing Author / E-E-A-T Signal", confidence: 80, evidence: ["No author detected"], impact: "medium", fix: "Add author name and brief bio", effort: "easy", priority: 3 });
  }
  if (!article?.hasDate) {
    failures.push({ type: "No Publication/Update Date", confidence: 75, evidence: ["No date found"], impact: "medium", fix: "Add visible publication date and last-updated date", effort: "easy", priority: 3 });
  }
  if ((isVisa || isTravel) && (article?.officialSourceLinks || []).length === 0) {
    failures.push({ type: "No Official Sources for Visa/Travel", confidence: 90, evidence: ["No .gov or embassy links found"], impact: "high", fix: "Add links to official embassy or government visa pages", effort: "medium", priority: 1 });
  }
  if ((article?.overclaims || []).length > 0) {
    failures.push({ type: "Compliance Risk: Overclaim Language", confidence: 95, evidence: article?.overclaims || [], impact: "high", fix: "Remove guarantee language; use softer, evidence-based wording", effort: "easy", priority: 1 });
  }
  if (!article?.metaDescription) {
    failures.push({ type: "Missing Meta Description", confidence: 99, evidence: ["No meta description tag"], impact: "medium", fix: "Write a 150–160 char meta description with keyword + CTA", effort: "easy", priority: 2 });
  }
  if (keyword && article?.title && !article.title.toLowerCase().includes(keyword.toLowerCase().split(" ")[0])) {
    failures.push({ type: "Keyword Missing from Title", confidence: 80, evidence: [`Title: "${article.title}" | Keyword: "${keyword}"`], impact: "high", fix: `Include "${keyword}" naturally in the title`, effort: "easy", priority: 1 });
  }
  if (article?.tableCount === 0 && (isVisa || isTravel)) {
    failures.push({ type: "No Tables in Visa/Travel Content", confidence: 85, evidence: ["Visa/travel articles benefit greatly from summary tables"], impact: "medium", fix: "Add a document checklist table or fee/timeline comparison table", effort: "medium", priority: 2 });
  }
  if ((article?.h2s || []).length < 3) {
    failures.push({ type: "Poor Content Structure", confidence: 90, evidence: [`Only ${article?.h2s?.length || 0} H2 sections`], impact: "medium", fix: "Add 5–8 H2 sections covering all major subtopics", effort: "medium", priority: 2 });
  }

  // Competitor gaps
  if (competitors.length > 0) {
    const compWithFaq = competitors.filter(c => c.extracted?.hasFaq).length;
    if (compWithFaq > 0 && !article?.hasFaq) {
      failures.push({ type: "Competitor FAQ Gap", confidence: 85, evidence: [`${compWithFaq} competitors have FAQ; you don't`], impact: "high", fix: "Build a comprehensive FAQ section", effort: "medium", priority: 1 });
    }
    const avgCompWc = competitors.reduce((s, c) => s + (c.extracted?.wordCount || 0), 0) / competitors.length;
    if (avgCompWc > 0 && (article?.wordCount || 0) < avgCompWc * 0.6) {
      failures.push({ type: "Content Depth Far Below Competitors", confidence: 85, evidence: [`Your content: ${article?.wordCount || 0} words | Competitor avg: ${Math.round(avgCompWc)} words`], impact: "high", fix: `Add ~${Math.round(avgCompWc * 0.8 - (article?.wordCount || 0))} more words to match competitor depth`, effort: "hard", priority: 1 });
    }
  }

  // Sort by priority
  failures.sort((a, b) => a.priority - b.priority);

  // Top problems
  const topProblems = failures.slice(0, 5).map(f => {
    if (isThai) {
      const thaiMap: Record<string, string> = {
        "Missing Title Tag": "ไม่มี Title Tag — Google ไม่รู้ว่าหน้านี้เกี่ยวกับอะไร",
        "Missing H1": "ไม่มี H1 — ขาด heading หลักที่สำคัญ",
        "Thin Content": `เนื้อหาบาง (${article?.wordCount || 0} คำ) — Google อาจมองว่าหน้านี้ไม่มีคุณค่าเพียงพอ`,
        "No FAQ Section": "ไม่มี FAQ — AI Search และ Google ไม่สามารถดึงคำตอบจากหน้านี้ได้",
        "No Internal Links": "ไม่มี Internal Links — หน้านี้โดดเดี่ยวและไม่ได้รับ PageRank จากเว็บไซต์",
        "Missing Author / E-E-A-T Signal": "ไม่มีชื่อผู้เขียน — ลดความน่าเชื่อถือของเนื้อหา",
        "No Official Sources for Visa/Travel": "ไม่มีแหล่งอ้างอิงทางการ — หน้าวีซ่า/ท่องเที่ยวต้องมี link ไปสถานทูตหรือรัฐบาล",
        "Compliance Risk: Overclaim Language": `มีคำเกินจริง: ${(article?.overclaims || []).join(", ")} — เสี่ยงผิด Google policy`,
      };
      return thaiMap[f.type] || f.type;
    }
    return `${f.type}: ${f.evidence[0] || ""}`;
  });

  const topFixes = failures.slice(0, 5).map(f => {
    if (isThai) {
      const fixMap: Record<string, string> = {
        "Missing Title Tag": "เพิ่ม Title Tag ที่มีคีย์เวิร์ดหลัก ความยาวไม่เกิน 60 ตัวอักษร",
        "Missing H1": "เพิ่ม H1 ที่ชัดเจนและมีคีย์เวิร์ด (มีได้แค่ 1 อัน)",
        "Thin Content": "ขยายเนื้อหาเป็น 1,200+ คำ โดยเพิ่มรายละเอียด ตัวอย่าง และขั้นตอน",
        "No FAQ Section": "เพิ่ม FAQ อย่างน้อย 5 ข้อ พร้อมคำตอบตรงๆ",
        "No Internal Links": "เพิ่ม Internal Link 3–5 จุดไปยังบทความที่เกี่ยวข้อง",
        "Missing Author / E-E-A-T Signal": "เพิ่มชื่อผู้เขียนและ bio สั้นๆ",
        "No Official Sources for Visa/Travel": "ลิงก์ไปเว็บสถานทูตหรือกระทรวงการต่างประเทศอย่างน้อย 2 แหล่ง",
        "Compliance Risk: Overclaim Language": "ลบหรือแก้ไขคำการันตี — ใช้คำที่ให้ข้อมูลแทน",
      };
      return fixMap[f.type] || f.fix;
    }
    return f.fix;
  });

  // One-sentence truth
  const worstFailure = failures[0];
  let oneSentenceTruth = "";
  if (worstFailure) {
    if (isThai) {
      const truthMap: Record<string, string> = {
        "Thin Content": "หน้านี้ยังมีเนื้อหาบางเกินไปและตอบคำถามผู้ใช้ได้ไม่ครบ",
        "No Internal Links": "หน้านี้โดดเดี่ยวเกินไป — เว็บไซต์ของคุณยังส่งสัญญาณมาสนับสนุนหน้านี้ไม่พอ",
        "No Official Sources for Visa/Travel": "Google ยังไม่เชื่อถือหน้าวีซ่านี้ เพราะขาดแหล่งอ้างอิงทางการ",
        "Compliance Risk: Overclaim Language": "หน้านี้มีคำพูดเกินจริงที่เสี่ยงต่อ Google policy และทำให้ผู้อ่านไม่เชื่อถือ",
        "Competitor FAQ Gap": "คู่แข่งตอบคำถามผู้ใช้ได้ครบกว่า และ Google เลือกหน้าที่ให้คำตอบที่ดีที่สุด",
        "Content Depth Far Below Competitors": "คู่แข่งอธิบายได้ลึกกว่าและครบกว่า ทำให้ Google เลือกพวกเขาแทนคุณ",
      };
      oneSentenceTruth = truthMap[worstFailure.type] || `ปัญหาหลักที่ทำให้หน้านี้ยังไม่ติดอันดับคือ: ${worstFailure.type}`;
    } else {
      oneSentenceTruth = `The main reason this page is not winning is: ${worstFailure.type.toLowerCase()} — ${worstFailure.evidence[0] || worstFailure.fix}`;
    }
  } else {
    oneSentenceTruth = isThai
      ? "หน้านี้มีพื้นฐานที่ดี แต่ยังมีโอกาสพัฒนาเพื่อแข่งขันในอันดับสูงขึ้น"
      : "This page has solid fundamentals but needs strategic improvements to reach Page 1";
  }

  // Final decision
  let finalDecision = "Optimize";
  if (failures.some(f => f.type === "Thin Content" && (article?.wordCount || 0) < 300)) finalDecision = "Rebuild From Scratch";
  else if (failures.filter(f => f.impact === "high").length >= 4) finalDecision = "Major Rewrite";
  else if (failures.length >= 6) finalDecision = "Major Rewrite";
  else if (failures.length >= 3) finalDecision = "Optimize";
  else if (failures.length === 0) finalDecision = "Keep";
  else finalDecision = "Minor Optimize";

  // Title options — use URL slug as fallback if no keyword detected
  const urlSlug = parsed.mainArticleUrl
    ? parsed.mainArticleUrl.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || ""
    : "";
  const kw = keyword || article?.h1 || article?.title?.split(/[-|–]/)[0]?.trim() || urlSlug || "this topic";
  const titleOptions = [
    `${kw} — Complete Guide ${new Date().getFullYear()}`,
    `How to ${kw}: Step-by-Step Guide`,
    `${kw}: Everything You Need to Know`,
    `The Ultimate ${kw} Guide (Updated ${new Date().getFullYear()})`,
    `${kw} — Practical Guide with Checklist`,
    `${kw}: Expert Tips & Common Mistakes`,
    `${kw} Guide: From Beginner to Expert`,
  ];

  // Meta options
  const metaOptions = [
    `Everything you need to know about ${kw}. Step-by-step guide, checklist, and expert tips. Updated ${new Date().getFullYear()}.`,
    `Learn ${kw} the right way. Complete guide with practical steps, common mistakes to avoid, and official resources.`,
    `Your complete ${kw} guide. Clear steps, expert advice, and official sources — get it right the first time.`,
    `Struggling with ${kw}? This guide covers every step with practical tips and official guidance. Read now.`,
    `${kw} made simple. Our expert guide covers requirements, process, timeline, and common pitfalls to avoid.`,
  ];

  // H2 suggestions
  const h2Suggestions = isVisa ? [
    `What is ${kw}? (Overview & Requirements)`,
    `Who Qualifies for ${kw}?`,
    `Required Documents Checklist`,
    `Step-by-Step Application Process`,
    `Timeline & Processing Time`,
    `Fees & Costs`,
    `Common Reasons for Rejection (and How to Avoid Them)`,
    `FAQ: Your ${kw} Questions Answered`,
    `Official Resources & Embassy Contacts`,
  ] : isTravel ? [
    `Why Visit? (Overview)`,
    `Best Time to Go`,
    `How to Get There`,
    `Where to Stay`,
    `Top Attractions & Experiences`,
    `Practical Tips & Costs`,
    `Common Mistakes to Avoid`,
    `FAQ`,
  ] : [
    `What is ${kw}? (Overview)`,
    `Why ${kw} Matters`,
    `How ${kw} Works: Step by Step`,
    `Key Requirements / What You Need`,
    `Common Mistakes to Avoid`,
    `Expert Tips for ${kw}`,
    `FAQ: ${kw} Explained`,
    `Next Steps`,
  ];

  // FAQ suggestions
  const faqSuggestions = isVisa ? [
    { q: `What documents are needed for ${kw}?`, a: "Required documents typically include a valid passport, application form, passport photos, bank statements, and supporting documents. Check the official embassy website for the complete list." },
    { q: `How long does ${kw} take to process?`, a: "Processing times vary. Typically 5–15 business days. Apply well in advance of your travel date." },
    { q: `Can my application be rejected?`, a: "Yes. Common reasons include incomplete documents, insufficient funds, or unclear travel purpose. Prepare thoroughly to minimize rejection risk." },
    { q: `How much does ${kw} cost?`, a: "Fees vary by country and visa type. Check the official embassy or consulate website for current fee schedules." },
    { q: `Where do I apply for ${kw}?`, a: "Applications are submitted at the official embassy, consulate, or designated visa application center. Online applications may also be available." },
  ] : [
    { q: `What is ${kw}?`, a: `${kw} refers to [brief definition]. It is important because it [key benefit].` },
    { q: `How does ${kw} work?`, a: `${kw} works by [brief explanation of process or mechanism].` },
    { q: `How long does ${kw} take?`, a: `The time required for ${kw} depends on [key factors]. Typically it takes [timeframe].` },
    { q: `What are common mistakes with ${kw}?`, a: `Common mistakes include [mistake 1], [mistake 2], and [mistake 3]. Avoid these by [solution].` },
    { q: `Where can I get official information about ${kw}?`, a: `For official information, visit [official source]. Always verify with authoritative sources.` },
  ];

  // Table suggestions
  const tableSuggestions = isVisa ? [
    "Required Documents Checklist (with ✓/✗ columns)",
    "Visa Fee Comparison Table (by visa type)",
    "Processing Timeline Table (step → estimated days)",
    "Embassy/Consulate Contact Information Table",
  ] : [
    "Feature/Option Comparison Table",
    "Step-by-Step Process Table",
    "Cost Breakdown Table",
    "Pros & Cons Table",
  ];

  // Internal links
  const internalLinkOpportunities = [
    `Link from your homepage/about page to this article`,
    `Create a related article and cross-link to this one`,
    `Add this article to your site's navigation or resource hub`,
    `Link from any related articles to this page using keyword-rich anchor text`,
    `If you have a pillar page on ${parsed.detectedArticleType.toLowerCase()}, link from there to this article`,
  ];

  // Official sources
  const officialSourceSuggestions = isVisa ? [
    "Official embassy or consulate website of the destination country",
    "Ministry of Foreign Affairs of Thailand (mfa.go.th) if relevant",
    "Schengen visa official portal (for Schengen countries)",
    "Official government visa application portal",
    "IATA Travel Centre for entry requirements",
  ] : isTravel ? [
    "Tourism Authority of Thailand (tourismthailand.org)",
    "Official country tourism board website",
    "IATA or airline official pages for flight requirements",
    "Official hotel or accommodation booking platforms",
  ] : [
    "Government or official regulatory body website",
    "Academic or peer-reviewed source",
    "Official industry association",
    "Official statistics from government agencies",
  ];

  // AI search findings
  const canExtract: string[] = [];
  const cannotExtract: string[] = [];

  if (article?.title) canExtract.push(`Title: "${article.title}"`);
  else cannotExtract.push("No title for AI to identify page topic");
  if (article?.hasFaq) canExtract.push("FAQ questions and answers");
  else cannotExtract.push("No FAQ — AI cannot extract direct question answers");
  if ((article?.tableCount || 0) > 0) canExtract.push(`${article?.tableCount} table(s) with structured data`);
  else cannotExtract.push("No tables — AI cannot extract structured comparison data");
  if ((article?.h2s || []).length > 2) canExtract.push(`${article?.h2s.length} H2 sections covering subtopics`);
  else cannotExtract.push("Too few H2 headings for AI to understand article structure");

  const aiSearchFindings = {
    canExtract,
    cannotExtract,
    suggestedQuickAnswer: isThai
      ? `[เพิ่มคำตอบสั้นๆ 2–3 ประโยคที่ตอบตรงๆ ว่า "${kw}" คืออะไรหรือทำอย่างไร — วางไว้ต้นบทความ]`
      : `Add a 2–3 sentence direct answer: "${kw} is [definition]. To [action], you need to [steps]. [Official source] confirms [key fact]."`,
    suggestedSummaryTable: ["Create a summary table at the top: Topic | Key Info | Official Source"],
  };

  // Freshness risks
  const freshnessRisks: string[] = [];
  const oldYears = (article?.mainText || "").match(/\b(201[0-9]|202[0-2])\b/g) || [];
  if (oldYears.length > 0) freshnessRisks.push(`Old year references found: ${[...new Set(oldYears)].join(", ")} — update to current year`);
  if (!article?.hasDate) freshnessRisks.push("No publication or update date shown — add 'Last updated: [date]' at the top");
  if (isVisa) freshnessRisks.push("Visa requirements change frequently — add a note about when information was last verified");

  // Conversion issues
  const conversionIssues: string[] = [];
  if (!article?.hasCtaSection) conversionIssues.push("No CTA detected — add a clear next step for the reader");
  if (isService && !article?.hasContactInfo) conversionIssues.push("Service page with no contact info — add phone, email, or booking link");
  if ((article?.ctaPhrases || []).length === 0) conversionIssues.push("No action-oriented phrases found — guide readers to the next step");

  // Rewrite brief
  const rewriteBrief = isThai
    ? `• Keyword: ${kw}\n• ความยาวเป้าหมาย: 1,200+ คำ\n• เปิดด้วย: ตอบตรงๆ ว่า "${kw}" คืออะไร ใน 150 คำแรก\n• โครงสร้าง: ใช้ H2 ที่ชัดเจน ${h2Suggestions.length} หัวข้อ\n• ต้องมี: ตาราง checklist เอกสาร/ขั้นตอน\n• ต้องมี: FAQ ${faqSuggestions.length} ข้อ พร้อมคำตอบตรงๆ\n• ต้องมี: Link ไปแหล่งทางการ (สถานทูต/รัฐบาล)\n• ห้าม: คำการันตี การยืนยัน 100% หรือคำเกินจริง\n• ปิดด้วย: CTA ที่ช่วยเหลือ ไม่กดดัน`
    : `• Keyword: ${kw}\n• Target length: 1,200+ words\n• Open with: Answer "${kw}" directly in first 150 words\n• Structure: ${h2Suggestions.length} clear H2 sections (see structure below)\n• Must include: Document/step checklist table\n• Must include: ${faqSuggestions.length}-question FAQ with direct answers\n• Must include: Links to official sources (embassy/government)\n• Avoid: Guarantee language, 100% certainty claims, vague filler\n• Close with: Helpful soft CTA — guide reader, don't pressure`;

  // Action plans
  const actionPlan24h = [
    `Fix title tag: Include "${kw}" and keep under 60 chars`,
    `Fix H1: Clear, keyword-rich, single H1`,
    `Write meta description: 150–160 chars with keyword + CTA`,
    `Add publication date and author name`,
    `Remove any overclaim/guarantee language`,
    ...(isVisa || isTravel ? ["Add link to official embassy/government source"] : []),
  ].slice(0, 6);

  const actionPlan7d = [
    "Expand content to 1,200+ words with practical depth",
    "Add 5–8 FAQ questions with direct answers",
    "Add at least one structured table or checklist",
    "Add 3–5 internal links to related content",
    "Add schema markup (Article, FAQ, BreadcrumbList)",
  ];

  const actionPlan14d = [
    "Research competitor content gaps and fill them",
    "Add a quick-answer summary box at the top",
    "Improve Open Graph tags for social sharing",
    "Request internal links from your most authoritative pages",
    "Set up a content update schedule for this article",
  ];

  const actionPlan30d = [
    "Build 3–5 supporting articles that link to this one",
    "Audit and improve all image alt text",
    "Add structured data for AI Search (FAQ schema, Article schema)",
    "Build topical authority with a content cluster around the main keyword",
    "Track SERP position and CTR via Google Search Console",
  ];

  // Co Journey check
  let coJourneyScore: number | null = null;
  let coJourneyChecklist: Array<{ label: string; pass: boolean; note: string }> | null = null;

  if (isVisa || isTravel) {
    const checks = [
      { label: "Thai expert tone", pass: parsed.detectedLanguage === "Thai" || parsed.detectedLanguage === "Thai/English mixed", note: "Write in clear, practical Thai for Thai readers" },
      { label: "No guarantee language (การันตี/ผ่านแน่นอน/100%)", pass: (article?.overclaims || []).length === 0, note: "Remove all guarantee/certainty claims" },
      { label: "Official source links", pass: (article?.officialSourceLinks || []).length > 0, note: "Link to official embassy or government pages" },
      { label: "Document checklist", pass: article?.listCount ? article.listCount > 0 : false, note: "Add a clear checklist of required documents" },
      { label: "Process/timeline section", pass: (article?.h2s || []).some(h => /process|step|timeline|ขั้นตอน|ระยะเวลา/i.test(h)), note: "Add step-by-step process and timeline" },
      { label: "Common mistakes section", pass: (article?.h2s || []).some(h => /mistake|avoid|reject|ข้อผิดพลาด|ปฏิเสธ/i.test(h)), note: "Add common mistakes and how to avoid them" },
      { label: "Author/date visible", pass: (article?.hasAuthor ?? false) && (article?.hasDate ?? false), note: "Show author name and last-updated date" },
      { label: "Soft CTA (not hard sell)", pass: (article?.hasCtaSection ?? false) && (article?.overclaims || []).length === 0, note: "Guide reader to contact/service without pressure" },
      { label: "Mobile-safe tables", pass: true, note: "Check tables render on mobile — consider scrollable containers" },
      { label: "FAQ schema consistency", pass: (article?.hasFaq ?? false) && (article?.schemaTypes || []).includes("FAQPage"), note: "Ensure FAQ schema matches visible FAQ content" },
    ];

    coJourneyScore = Math.round((checks.filter(c => c.pass).length / checks.length) * 100);
    coJourneyChecklist = checks;
  }

  return {
    failureReasons: failures,
    topProblems,
    topFixes,
    oneSentenceTruth,
    finalDecision,
    titleOptions,
    metaOptions,
    h2Suggestions,
    faqSuggestions,
    tableSuggestions,
    internalLinkOpportunities,
    officialSourceSuggestions,
    aiSearchFindings,
    freshnessRisks,
    conversionIssues,
    rewriteBrief,
    actionPlan24h,
    actionPlan7d,
    actionPlan14d,
    actionPlan30d,
    coJourneyScore,
    coJourneyChecklist,
  };
}
