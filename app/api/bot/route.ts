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

async function loadBot(userId: string) {
  const [config, state, positions] = await Promise.all([
    prisma.botConfig.findUnique({
      where: { userId },
    }),

    prisma.botState.findUnique({
      where: { userId },
    }),

    prisma.botPosition.findMany({
      where: {
        userId,
        status: "OPEN",
      },
      orderBy: { openedAt: "desc" },
    }),
  ]);

  return { config, state, positions };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const bot = await loadBot(user.id);

    return ok({ bot });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", {
      message: e?.message ?? String(e),
    });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const body = await req.json().catch(() => null);

    const exchange =
      body?.exchange === "BINANCE" ||
      body?.exchange === "BYBIT" ||
      body?.exchange === "OKX"
        ? body.exchange
        : "BINANCE";

    const keyId =
      typeof body?.keyId === "string" && body.keyId.trim().length > 0
        ? body.keyId.trim()
        : "";

    const maxActiveSymbolsRaw = Number(body?.maxActiveSymbols);
    const maxActiveSymbols =
      Number.isFinite(maxActiveSymbolsRaw) && maxActiveSymbolsRaw > 0
        ? Math.floor(maxActiveSymbolsRaw)
        : 10;

    const budgetPerSymbolRaw = Number(body?.budgetPerSymbol);
    const budgetPerSymbol =
      Number.isFinite(budgetPerSymbolRaw) && budgetPerSymbolRaw >= 0
        ? budgetPerSymbolRaw.toString()
        : "0";

    const gridStepPctRaw = Number(body?.gridStepPct);
    const gridStepPct =
      Number.isFinite(gridStepPctRaw) && gridStepPctRaw > 0
        ? gridStepPctRaw.toString()
        : "5";

    const takeProfitPctRaw = Number(body?.takeProfitPct);
    const takeProfitPct =
      Number.isFinite(takeProfitPctRaw) && takeProfitPctRaw > 0
        ? takeProfitPctRaw.toString()
        : "5";

    if (!keyId) {
      return fail(400, "KEY_ID_REQUIRED");
    }

    const key = await prisma.userKey.findFirst({
      where: {
        id: keyId,
        userId: user.id,
        exchange,
      },
      select: {
        id: true,
        exchange: true,
      },
    });

    if (!key) {
      return fail(404, "KEY_NOT_FOUND");
    }

    await Promise.all([
      prisma.botConfig.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          exchange,
          keyId: key.id,
          enabled: false,
          maxActiveSymbols,
          budgetPerSymbol,
          gridStepPct,
          takeProfitPct,
        },
        update: {
          exchange,
          keyId: key.id,
          maxActiveSymbols,
          budgetPerSymbol,
          gridStepPct,
          takeProfitPct,
        },
      }),

      prisma.botState.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          status: "STOPPED",
          lastError: null,
          lastSyncAt: null,
        },
        update: {},
      }),
    ]);

    const bot = await loadBot(user.id);

    return ok({ bot });
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

    const action =
      body?.action === "start" ||
      body?.action === "stop" ||
      body?.action === "reset"
        ? body.action
        : "";

    if (!action) {
      return fail(400, "ACTION_REQUIRED");
    }

    const config = await prisma.botConfig.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        userId: true,
        keyId: true,
        exchange: true,
      },
    });

    if (action === "reset") {
      await prisma.botState.deleteMany({
        where: { userId: user.id },
      });

      await prisma.botConfig.deleteMany({
        where: { userId: user.id },
      });

      const bot = await loadBot(user.id);
      return ok({ bot });
    }

    if (!config) {
      return fail(404, "BOT_CONFIG_NOT_FOUND");
    }

    const key = await prisma.userKey.findFirst({
      where: {
        id: config.keyId,
        userId: user.id,
        exchange: config.exchange,
      },
      select: { id: true },
    });

    if (!key) {
      return fail(404, "KEY_NOT_FOUND");
    }

    if (action === "start") {
      await Promise.all([
        prisma.botConfig.update({
          where: { userId: user.id },
          data: { enabled: true },
        }),
        prisma.botState.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            status: "RUNNING",
            lastError: null,
            lastSyncAt: null,
          },
          update: {
            status: "RUNNING",
            lastError: null,
          },
        }),
      ]);
    }

    if (action === "stop") {
      await Promise.all([
        prisma.botConfig.update({
          where: { userId: user.id },
          data: { enabled: false },
        }),
        prisma.botState.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            status: "STOPPED",
            lastError: null,
            lastSyncAt: null,
          },
          update: {
            status: "STOPPED",
          },
        }),
      ]);
    }

    const bot = await loadBot(user.id);

    return ok({ bot });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", {
      message: e?.message ?? String(e),
    });
  }
}
