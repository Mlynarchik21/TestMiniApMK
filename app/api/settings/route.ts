// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";

function ok(data: any) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  try {
    const { user } = await requireUser();

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: {
        timezone: true,
        currency: true,
        riskMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // если настроек ещё нет — возвращаем дефолт, но НЕ создаём запись
    if (!settings) {
      return ok({
        settings: {
          timezone: "UTC",
          currency: "USD",
          riskMode: "normal",
        },
      });
    }

    return ok({ settings });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR");
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireUser();

    const body = await req.json().catch(() => null);

    const timezone =
      typeof body?.timezone === "string" && body.timezone.length <= 64 ? body.timezone : undefined;

    const currency =
      typeof body?.currency === "string" && body.currency.length <= 16 ? body.currency : undefined;

    const riskModeRaw = typeof body?.riskMode === "string" ? body.riskMode : undefined;
    const riskMode =
      riskModeRaw === "normal" || riskModeRaw === "conservative" || riskModeRaw === "aggressive"
        ? riskModeRaw
        : undefined;

    if (!timezone && !currency && !riskMode) {
      return fail(400, "NO_FIELDS");
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        timezone: timezone ?? "UTC",
        currency: currency ?? "USD",
        riskMode: riskMode ?? "normal",
      },
      update: {
        ...(timezone ? { timezone } : {}),
        ...(currency ? { currency } : {}),
        ...(riskMode ? { riskMode } : {}),
        // updatedAt в БД дефолтный now(), но Prisma @updatedAt обновит сам
      },
      select: {
        timezone: true,
        currency: true,
        riskMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({ settings });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR");
  }
}
