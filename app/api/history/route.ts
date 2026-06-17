import { NextRequest, NextResponse } from "next/server";

// History is available when DATABASE_URL is configured.

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/db");
    return prisma;
  } catch {
    return null;
  }
}

export async function GET() {
  const db = await getPrisma();
  if (!db) return NextResponse.json([]);
  try {
    const scans = await db.scan.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        detectedMainUrl: true,
        detectedKeyword: true,
        detectedArticleType: true,
        detectedLanguage: true,
        score: true,
        verdict: true,
        finalDecision: true,
        createdAt: true,
      },
    });
    return NextResponse.json(scans);
  } catch {
    return NextResponse.json([]);
  }
}

export async function DELETE(req: NextRequest) {
  const db = await getPrisma();
  if (!db) return NextResponse.json({ error: "History not available" }, { status: 503 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await db.scan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
