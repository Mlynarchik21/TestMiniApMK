import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

function errToJson(e: any) {
  return {
    message: e?.message ?? String(e),
    code: e?.code ?? null,
    name: e?.name ?? null,
    meta: e?.meta ?? null,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, settings: {} },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    console.error("GET /api/profile:", e);
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const settings = body?.settings ?? {};

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: { settings },
      create: { userId: user.id, settings },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    console.error("PATCH /api/profile:", e);
    return NextResponse.json({ ok: false, error: errToJson(e) }, { status: 500 });
  }
}
