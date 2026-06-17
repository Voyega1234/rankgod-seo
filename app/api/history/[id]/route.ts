import { NextRequest, NextResponse } from "next/server";

async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { prisma } = await import("@/lib/db");
    return prisma;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = await getPrisma();
  if (!db) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const scan = await db.scan.findUnique({ where: { id: params.id } });
    if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(scan);
  } catch {
    return NextResponse.json({ error: "Failed to fetch scan" }, { status: 500 });
  }
}
