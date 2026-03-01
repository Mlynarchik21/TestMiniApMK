import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";

/**
 * GET /api/profile
 * Создаёт профиль при первом запросе и возвращает его.
 */
export async function GET() {
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
}

/**
 * PATCH /api/profile
 * Обновляет settings целиком (JSON).
 * Body: { "settings": { ... } }
 */
export async function PATCH(req: Request) {
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
}
