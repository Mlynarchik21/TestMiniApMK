// app/api/bot/route.ts
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

    const [config, state, positions] = await Promise.all([
      prisma.botConfig.findUnique({
        where: { userId: user.id },
      }),

      prisma.botState.findUnique({
        where: { userId: user.id },
      }),

      prisma.botPosition.findMany({
        where: {
          userId: user.id,
          status: "OPEN",
        },
        orderBy: { openedAt: "desc" },
      }),
    ]);

    return ok({
      bot: {
        config,
        state,
        positions,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", {
      message: e?.message ?? String(e),
    });
  }
}
