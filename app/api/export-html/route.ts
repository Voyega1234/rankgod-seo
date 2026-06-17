import { NextRequest, NextResponse } from "next/server";
import { generateSalesHtml } from "@/lib/exportHtml";
import type { SiteAuditResult } from "@/lib/siteAudit";

export async function POST(req: NextRequest) {
  try {
    const result: SiteAuditResult = await req.json();

    if (!result || !result.domain) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const html = generateSalesHtml(result);

    if (!html || html.length < 500) {
      return NextResponse.json({ error: "สร้างรายงานไม่สำเร็จ" }, { status: 500 });
    }

    const hostname = (() => {
      try { return new URL(result.domain).hostname; }
      catch { return result.domain.replace(/[^a-z0-9.-]/gi, ""); }
    })();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `seo-audit-${hostname}-${date}.html`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": Buffer.byteLength(html, "utf-8").toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-html] error:", err);
    return NextResponse.json(
      { error: "สร้าง HTML ล้มเหลว กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
