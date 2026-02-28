import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const now = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now`;
    return NextResponse.json({ ok: true, db: true, now: now?.[0]?.now ?? null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: false, error: e?.message ?? "DB error" },
      { status: 500 }
    );
  }
}
