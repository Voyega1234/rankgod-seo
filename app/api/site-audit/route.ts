import { NextRequest, NextResponse } from "next/server";
import { runSiteAudit } from "@/lib/siteAudit";
import { isSafeInput } from "@/lib/safety";

export async function POST(req: NextRequest) {
  let domain = "";
  try {
    const body = await req.json();
    domain = body?.domain ?? "";
    const model: string | undefined = body?.model;

    if (!domain || typeof domain !== "string" || domain.trim().length === 0) {
      return NextResponse.json({ error: "กรุณาระบุ domain" }, { status: 400 });
    }

    const cleaned = domain.trim().replace(/\/+$/, "");
    if (!isSafeInput(cleaned)) {
      return NextResponse.json({ error: "Domain ไม่ถูกต้อง" }, { status: 400 });
    }

    let base: string;
    try {
      base = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
      new URL(base); // validate
    } catch {
      return NextResponse.json({ error: "รูปแบบ domain ไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await runSiteAudit(base, model);
    return NextResponse.json(result);

  } catch (err) {
    console.error("[site-audit] error:", err);
    const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";

    // Distinguish timeout from other errors
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET")) {
      return NextResponse.json(
        { error: `เว็บไซต์ตอบช้าเกินไป หรือ block การ crawl — ลองใหม่หรือ check ว่าเว็บ online อยู่` },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: msg.length > 200 ? "Scan ล้มเหลว กรุณาลองใหม่" : msg },
      { status: 500 }
    );
  }
}

export const maxDuration = 300;
