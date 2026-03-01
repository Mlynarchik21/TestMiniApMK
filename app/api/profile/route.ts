import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        settings: {},
      },
      update: {},
      select: {
        id: true,
        userId: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "profile error" },
      { status: 401 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({} as any));

    // ожидаем: { settings: { ... } }
    const nextSettings = body?.settings ?? null;
    if (!nextSettings || typeof nextSettings !== "object") {
      return NextResponse.json(
        { ok: false, error: "settings object required" },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        settings: nextSettings,
      },
      update: {
        settings: nextSettings,
      },
      select: {
        id: true,
        userId: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "profile error" },
      { status: 401 }
    );
  }
}
