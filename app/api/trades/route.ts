// app/api/trades/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

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

function isExchange(v: unknown): v is "BINANCE" | "BYBIT" | "OKX" {
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

function toStr(v: any) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v?.toString === "function") return v.toString();
  return String(v);
}

// GET /api/trades?cursor=<id>&take=20&exchange=BINANCE&status=OPEN
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);

    const takeRaw = url.searchParams.get("take");
    const take = Math.max(1, Math.min(50, Number(takeRaw || "20") || 20));

    const cursorId = str(url.searchParams.get("cursor") || "").trim();
    const exchangeParam = url.searchParams.get("exchange");
    const statusParam = url.searchParams.get("status");

    const filters: Prisma.Sql[] = [Prisma.sql`"userId" = ${user.id}`];

    if (exchangeParam && isExchange(exchangeParam)) {
      filters.push(Prisma.sql`"exchange" = ${exchangeParam}::"Exchange"`);
    }
    if (statusParam && isStatus(statusParam)) {
      filters.push(Prisma.sql`"status" = ${statusParam}::"TradeStatus"`);
    }

    // cursor: берём openedAt у cursorId, чтобы корректно продолжать сортировку (openedAt desc, id desc)
    let cursorOpenedAt: Date | null = null;
    if (cursorId) {
      const c = await prisma.$queryRaw<{ openedAt: Date }[]>(
        Prisma.sql`
          select "openedAt"
          from "Trade"
          where "id" = ${cursorId} and "userId" = ${user.id}
          limit 1
        `
      );
      cursorOpenedAt = c?.[0]?.openedAt ?? null;
    }

    if (cursorId && cursorOpenedAt) {
      // следующие записи после курсора при сортировке desc:
      // openedAt < cursorOpenedAt OR (openedAt = cursorOpenedAt AND id < cursorId)
      filters.push(
        Prisma.sql`(
          "openedAt" < ${cursorOpenedAt}
          OR ("openedAt" = ${cursorOpenedAt} AND "id" < ${cursorId})
        )`
      );
    }

    const whereSql =
      filters.length === 1 ? filters[0] : Prisma.sql`${Prisma.join(filters, Prisma.sql` AND `)}`;

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        select
          "id",
          "exchange",
          "symbol",
          "side",
          "status",
          "qty",
          "entryPrice",
          "exitPrice",
          "realizedPnl",
          "openedAt",
          "closedAt",
          "createdAt",
          "updatedAt"
        from "Trade"
        where ${whereSql}
        order by "openedAt" desc, "id" desc
        limit ${take + 1}
      `
    );

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    const out = items.map((t: any) => ({
      id: String(t.id),
      exchange: String(t.exchange),
      symbol: String(t.symbol),
      side: String(t.side),
      status: String(t.status),
      qty: toStr(t.qty) ?? "0",
      entryPrice: toStr(t.entryPrice),
      exitPrice: toStr(t.exitPrice),
      realizedPnl: toStr(t.realizedPnl),
      openedAt: new Date(t.openedAt).toISOString(),
      closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : null,
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString(),
    }));

    return ok({ trades: out, nextCursor });
  } catch (e: AnyJson) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
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
 *   realizedPnl?: "10.5"
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

    const tradeId = crypto.randomUUID();
    const now = new Date();

    // Insert Trade
    await prisma.$executeRaw(
      Prisma.sql`
        insert into "Trade" (
          "id",
          "userId",
          "exchange",
          "symbol",
          "side",
          "status",
          "qty",
          "entryPrice",
          "exitPrice",
          "realizedPnl",
          "openedAt",
          "closedAt",
          "createdAt",
          "updatedAt"
        ) values (
          ${tradeId},
          ${user.id},
          ${exchange}::"Exchange",
          ${symbol},
          ${side}::"TradeSide",
          ${status}::"TradeStatus",
          ${qtyStr}::numeric,
          ${entryStr ? Prisma.sql`${entryStr}::numeric` : Prisma.sql`null`},
          ${exitStr ? Prisma.sql`${exitStr}::numeric` : Prisma.sql`null`},
          ${pnlStr ? Prisma.sql`${pnlStr}::numeric` : Prisma.sql`null`},
          ${openedAt ?? now},
          ${closedAt ?? Prisma.sql`null`},
          ${now},
          ${now}
        )
      `
    );

    // Insert TradeEvent
    const eventId = crypto.randomUUID();
    const payload = {
      tradeId,
      symbol,
      side,
      status,
      source: "manual",
    };

    await prisma.$executeRaw(
      Prisma.sql`
        insert into "TradeEvent" (
          "id",
          "userId",
          "exchange",
          "type",
          "tradeId",
          "payload",
          "createdAt"
        ) values (
          ${eventId},
          ${user.id},
          ${exchange}::"Exchange",
          ${"MANUAL_CREATE"}::"TradeEventType",
          ${tradeId},
          ${JSON.stringify(payload)}::jsonb,
          ${now}
        )
      `
    );

    // Return created trade (read back)
    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        select
          "id",
          "exchange",
          "symbol",
          "side",
          "status",
          "qty",
          "entryPrice",
          "exitPrice",
          "realizedPnl",
          "openedAt",
          "closedAt",
          "createdAt",
          "updatedAt"
        from "Trade"
        where "id" = ${tradeId} and "userId" = ${user.id}
        limit 1
      `
    );

    const t = rows?.[0];
    if (!t) return fail(500, "SERVER_ERROR", "trade not found after insert");

    return ok({
      trade: {
        id: String(t.id),
        exchange: String(t.exchange),
        symbol: String(t.symbol),
        side: String(t.side),
        status: String(t.status),
        qty: toStr(t.qty) ?? "0",
        entryPrice: toStr(t.entryPrice),
        exitPrice: toStr(t.exitPrice),
        realizedPnl: toStr(t.realizedPnl),
        openedAt: new Date(t.openedAt).toISOString(),
        closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : null,
        createdAt: new Date(t.createdAt).toISOString(),
        updatedAt: new Date(t.updatedAt).toISOString(),
      },
    });
  } catch (e: AnyJson) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}
