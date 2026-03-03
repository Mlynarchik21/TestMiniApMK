// app/api/settings/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

// BigInt-safe JSON
function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

function ok(data: any) {
  return json({ ok: true, ...data });
}

function fail(status: number, error: string, extra?: any) {
  return json({ ok: false, error, ...(extra ? { extra } : {}) }, { status });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

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

    if (!settings) {
      return ok({
        settings: {
          timezone: "UTC",
          currency: "USD",
          riskMode: "normal",
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    return ok({ settings });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", {
      message: e?.message ?? String(e),
    });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);

    const body = await req.json().catch(() => null);

    const timezone =
      typeof body?.timezone === "string" && body.timezone.length <= 64
        ? body.timezone
        : undefined;

    const currency =
      typeof body?.currency === "string" && body.currency.length <= 16
        ? body.currency
        : undefined;

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
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", {
      message: e?.message ?? String(e),
    });
  }
}
