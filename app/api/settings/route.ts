// app/api/settings/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { cookies, headers } from "next/headers";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ✅ BigInt-safe JSON
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

async function getAuthedUser() {
  const auth = headers().get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = cookies().get("session")?.value || "";
  const rawToken = bearer || cookieToken;

  if (!rawToken) return null;

  const tokenHash = sha256hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function GET() {
  try {
    const user = await getAuthedUser();
    if (!user) return fail(401, "UNAUTHORIZED");

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
    return fail(500, "SERVER_ERROR", { message: e?.message ?? String(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAuthedUser();
    if (!user) return fail(401, "UNAUTHORIZED");

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
    return fail(500, "SERVER_ERROR", { message: e?.message ?? String(e) });
  }
}
