// app/api/bot/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { Exchange, Prisma } from "@prisma/client";

export const runtime = "nodejs";

type AnyJson = any;

function ok(data: AnyJson) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string, extra?: AnyJson) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

function isExchange(v: unknown): v is Exchange {
  return v === "BINANCE" || v === "BYBIT" || v === "OKX";
}

function parseIntSafe(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.trim());
  return Number.isInteger(n) ? n : null;
}

function parseDecimalString(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
}

// GET /api/bot
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const [config, state, positions] = await Promise.all([
      prisma.botConfig.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          exchange: true,
          keyId: true,
          enabled: true,
          maxActiveSymbols: true,
          budgetPerSymbol: true,
          maxTotalBudget: true,
          syncIntervalMin: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.botState.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          status: true,
          lastSyncAt: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.botPosition.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          exchange: true,
          symbol: true,
          status: true,
          avgPrice: true,
          qty: true,
          tpPrice: true,
          addsCount: true,
          investedQuote: true,
          openedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return ok({
      config: config
        ? {
            ...config,
            budgetPerSymbol: config.budgetPerSymbol.toString(),
            maxTotalBudget: config.maxTotalBudget?.toString() ?? null,
          }
        : null,
      state,
      positions: positions.map((p) => ({
        ...p,
        avgPrice: p.avgPrice.toString(),
        qty: p.qty.toString(),
        tpPrice: p.tpPrice.toString(),
        investedQuote: p.investedQuote.toString(),
      })),
    });
  } catch (e: AnyJson) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}

// PATCH /api/bot
export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => null)) as AnyJson | null;

    if (!body) {
      return fail(400, "BAD_REQUEST", "JSON body required");
    }

    let exchange: Exchange | undefined;
    if (body.exchange != null) {
      if (!isExchange(body.exchange)) {
        return fail(400, "BAD_REQUEST", "exchange invalid");
      }
      exchange = body.exchange;
    }

    let keyId: string | null | undefined = undefined;
    if (body.keyId !== undefined) {
      if (body.keyId === null || body.keyId === "") {
        keyId = null;
      } else if (typeof body.keyId === "string") {
        keyId = body.keyId.trim();
      } else {
        return fail(400, "BAD_REQUEST", "keyId invalid");
      }
    }

    let maxActiveSymbols: number | undefined;
    if (body.maxActiveSymbols != null) {
      const n = parseIntSafe(body.maxActiveSymbols);
      if (n == null || n < 1 || n > 10) {
        return fail(400, "BAD_REQUEST", "maxActiveSymbols must be integer 1..10");
      }
      maxActiveSymbols = n;
    }

    let budgetPerSymbol: Prisma.Decimal | undefined;
    if (body.budgetPerSymbol != null) {
      const s = parseDecimalString(body.budgetPerSymbol);
      if (!s) return fail(400, "BAD_REQUEST", "budgetPerSymbol invalid");
      budgetPerSymbol = new Prisma.Decimal(s);
      if (budgetPerSymbol.lte(0)) {
        return fail(400, "BAD_REQUEST", "budgetPerSymbol must be > 0");
      }
    }

    let maxTotalBudget: Prisma.Decimal | null | undefined = undefined;
    if (body.maxTotalBudget !== undefined) {
      if (body.maxTotalBudget === null || body.maxTotalBudget === "") {
        maxTotalBudget = null;
      } else {
        const s = parseDecimalString(body.maxTotalBudget);
        if (!s) return fail(400, "BAD_REQUEST", "maxTotalBudget invalid");
        maxTotalBudget = new Prisma.Decimal(s);
        if (maxTotalBudget.lte(0)) {
          return fail(400, "BAD_REQUEST", "maxTotalBudget must be > 0");
        }
      }
    }

    let syncIntervalMin: number | undefined;
    if (body.syncIntervalMin != null) {
      const n = parseIntSafe(body.syncIntervalMin);
      if (n == null || n < 1 || n > 60) {
        return fail(400, "BAD_REQUEST", "syncIntervalMin must be integer 1..60");
      }
      syncIntervalMin = n;
    }

    if (keyId) {
      const key = await prisma.userKey.findFirst({
        where: { id: keyId, userId: user.id },
        select: { id: true },
      });

      if (!key) {
        return fail(404, "NOT_FOUND", "key not found");
      }
    }

    const config = await prisma.botConfig.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        exchange: exchange ?? "BINANCE",
        keyId: keyId ?? null,
        enabled: false,
        maxActiveSymbols: maxActiveSymbols ?? 10,
        budgetPerSymbol: budgetPerSymbol ?? new Prisma.Decimal("50"),
        maxTotalBudget: maxTotalBudget ?? null,
        syncIntervalMin: syncIntervalMin ?? 5,
      },
      update: {
        ...(exchange !== undefined ? { exchange } : {}),
        ...(keyId !== undefined ? { keyId } : {}),
        ...(maxActiveSymbols !== undefined ? { maxActiveSymbols } : {}),
        ...(budgetPerSymbol !== undefined ? { budgetPerSymbol } : {}),
        ...(maxTotalBudget !== undefined ? { maxTotalBudget } : {}),
        ...(syncIntervalMin !== undefined ? { syncIntervalMin } : {}),
      },
      select: {
        id: true,
        userId: true,
        exchange: true,
        keyId: true,
        enabled: true,
        maxActiveSymbols: true,
        budgetPerSymbol: true,
        maxTotalBudget: true,
        syncIntervalMin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.botState.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: "IDLE",
      },
      update: {},
    });

    return ok({
      config: {
        ...config,
        budgetPerSymbol: config.budgetPerSymbol.toString(),
        maxTotalBudget: config.maxTotalBudget?.toString() ?? null,
      },
    });
  } catch (e: AnyJson) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}