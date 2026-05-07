// app/api/bot/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { getPlanInfo } from "@/lib/auth/requirePlan";
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

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAddsCount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function isRealOpenPosition(p: {
  qty: Prisma.Decimal | string | number;
  investedQuote: Prisma.Decimal | string | number;
  avgPrice: Prisma.Decimal | string | number;
  symbol: string;
}) {
  const qty = toNum(p.qty);
  const investedQuote = toNum(p.investedQuote);
  const avgPrice = toNum(p.avgPrice);
  const symbol = String(p.symbol || "").trim();

  if (!symbol) return false;
  if (qty <= 0) return false;
  if (investedQuote <= 0) return false;
  if (avgPrice <= 0) return false;

  return true;
}

// GET /api/bot
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const [config, state, positionsRaw] = await Promise.all([
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
        where: {
          userId: user.id,
          status: "OPEN",
        },
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

    const positions = positionsRaw
      .filter(isRealOpenPosition)
      .map((p) => ({
        ...p,
        avgPrice: p.avgPrice.toString(),
        qty: p.qty.toString(),
        tpPrice: p.tpPrice.toString(),
        investedQuote: p.investedQuote.toString(),
        addsCount: normalizeAddsCount(p.addsCount),
      }));

    return ok({
      config: config
        ? {
            ...config,
            budgetPerSymbol: config.budgetPerSymbol.toString(),
          }
        : null,
      state,
      activePositions: positions.length,
      positions,
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

    const planInfo = await getPlanInfo(user.id);
    const planLimit = planInfo.maxActiveSymbols || 10;

    let maxActiveSymbols: number | undefined;
    if (body.maxActiveSymbols != null) {
      const n = parseIntSafe(body.maxActiveSymbols);
      if (n == null || n < 1 || n > 10) {
        return fail(400, "BAD_REQUEST", "maxActiveSymbols must be integer 1..10");
      }
      maxActiveSymbols = Math.min(n, planLimit);
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
      },
      update: {
        ...(exchange !== undefined ? { exchange } : {}),
        ...(keyId !== undefined ? { keyId } : {}),
        ...(maxActiveSymbols !== undefined ? { maxActiveSymbols } : {}),
        ...(budgetPerSymbol !== undefined ? { budgetPerSymbol } : {}),
      },
      select: {
        id: true,
        userId: true,
        exchange: true,
        keyId: true,
        enabled: true,
        maxActiveSymbols: true,
        budgetPerSymbol: true,
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