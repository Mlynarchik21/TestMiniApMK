// app/api/trades/route.ts
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

function str(v: unknown) {
  return typeof v === "string" ? v : "";
}

function isExchange(v: unknown): v is Exchange {
  return v === "BINANCE" || v === "BYBIT" || v === "OKX";
}

function isSide(v: unknown): v is "BUY" | "SELL" {
  return v === "BUY" || v === "SELL";
}

function isStatus(v: unknown): v is "OPEN" | "CLOSED" | "CANCELED" {
  return v === "OPEN" || v === "CLOSED" || v === "CANCELED";
}

function parseDecimalString(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  // допускаем только числа/точку/минус (для pnl)
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET /api/trades?cursor=<id>&take=20&exchange=BINANCE&status=OPEN
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);

    const takeRaw = url.searchParams.get("take");
    const take = Math.max(1, Math.min(50, Number(takeRaw || "20") || 20));

    const cursor = str(url.searchParams.get("cursor") || "");
    const exchangeParam = url.searchParams.get("exchange");
    const statusParam = url.searchParams.get("status");

    const where: Prisma.TradeWhereInput = { userId: user.id };

    if (exchangeParam && isExchange(exchangeParam)) where.exchange = exchangeParam;
    if (statusParam && isStatus(statusParam)) where.status = statusParam;

    const rows = await prisma.trade.findMany({
      where,
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        exchange: true,
        symbol: true,
        side: true,
        status: true,
        qty: true,
        entryPrice: true,
        exitPrice: true,
        realizedPnl: true,
        openedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    // Decimal -> string (чтобы не было проблем в JSON)
    const out = items.map((t) => ({
      ...t,
      qty: t.qty.toString(),
      entryPrice: t.entryPrice?.toString() ?? null,
      exitPrice: t.exitPrice?.toString() ?? null,
      realizedPnl: t.realizedPnl?.toString() ?? null,
    }));

    return ok({ trades: out, nextCursor });
  } catch (e: AnyJson) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}

/**
 * POST /api/trades (manual MVP)
 * body:
 * {
 *   exchange: "BINANCE",
 *   symbol: "BTCUSDT",
 *   side: "BUY",
 *   status?: "OPEN"|"CLOSED"|"CANCELED",
 *   qty: "0.01",
 *   entryPrice?: "65000",
 *   exitPrice?: "66000",
 *   realizedPnl?: "10.5",
 *   openedAt?: "2026-03-05T12:00:00.000Z",
 *   closedAt?: "2026-03-05T13:00:00.000Z"
 * }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => null)) as AnyJson | null;
    if (!body) return fail(400, "BAD_REQUEST", "JSON body required");

    const exchange = body.exchange;
    if (!isExchange(exchange)) return fail(400, "BAD_REQUEST", "exchange invalid");

    const symbol = str(body.symbol).trim().toUpperCase();
    if (!symbol || symbol.length > 32) return fail(400, "BAD_REQUEST", "symbol invalid");

    const side = body.side;
    if (!isSide(side)) return fail(400, "BAD_REQUEST", "side invalid");

    const status = body.status && isStatus(body.status) ? body.status : "OPEN";

    const qtyStr = parseDecimalString(body.qty);
    if (!qtyStr) return fail(400, "BAD_REQUEST", "qty invalid");

    const entryStr = body.entryPrice != null ? parseDecimalString(body.entryPrice) : null;
    if (body.entryPrice != null && !entryStr) return fail(400, "BAD_REQUEST", "entryPrice invalid");

    const exitStr = body.exitPrice != null ? parseDecimalString(body.exitPrice) : null;
    if (body.exitPrice != null && !exitStr) return fail(400, "BAD_REQUEST", "exitPrice invalid");

    const pnlStr = body.realizedPnl != null ? parseDecimalString(body.realizedPnl) : null;
    if (body.realizedPnl != null && !pnlStr) return fail(400, "BAD_REQUEST", "realizedPnl invalid");

    const openedAt = body.openedAt ? parseDate(body.openedAt) : null;
    if (body.openedAt && !openedAt) return fail(400, "BAD_REQUEST", "openedAt invalid ISO date");

    const closedAt = body.closedAt ? parseDate(body.closedAt) : null;
    if (body.closedAt && !closedAt) return fail(400, "BAD_REQUEST", "closedAt invalid ISO date");

    const trade = await prisma.trade.create({
      data: {
        user: { connect: { id: user.id } },
        exchange,
        symbol,
        side,
        status,
        qty: new Prisma.Decimal(qtyStr),
        entryPrice: entryStr ? new Prisma.Decimal(entryStr) : null,
        exitPrice: exitStr ? new Prisma.Decimal(exitStr) : null,
        realizedPnl: pnlStr ? new Prisma.Decimal(pnlStr) : null,
        openedAt: openedAt ?? undefined,
        closedAt: closedAt ?? undefined,
      },
      select: {
        id: true,
        exchange: true,
        symbol: true,
        side: true,
        status: true,
        qty: true,
        entryPrice: true,
        exitPrice: true,
        realizedPnl: true,
        openedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Логируем событие (MVP)
    await prisma.tradeEvent.create({
      data: {
        user: { connect: { id: user.id } },
        exchange,
        type: "MANUAL_CREATE",
        trade: { connect: { id: trade.id } },
        payload: {
          tradeId: trade.id,
          symbol,
          side,
          status,
        },
      },
      select: { id: true },
    });

    return ok({
      trade: {
        ...trade,
        qty: trade.qty.toString(),
        entryPrice: trade.entryPrice?.toString() ?? null,
        exitPrice: trade.exitPrice?.toString() ?? null,
        realizedPnl: trade.realizedPnl?.toString() ?? null,
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
