import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

type CloseReason = "TP" | "MANUAL" | "STOP" | "OTHER";

type DerivedTrade = {
  id: string;
  botPositionId: string;
  exchange: string;
  symbol: string;
  entryValue: number;
  exitValue: number;
  qty: number;
  avgEntryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  addsCount: number;
  closeReason: CloseReason;
  openedAt: Date;
  closedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDateOrNull(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
}

function iso(v: Date | null | undefined) {
  return v ? v.toISOString() : null;
}

function upper(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function isFilledStatus(v: unknown) {
  return upper(v) === "FILLED";
}

function mapTrade(t: DerivedTrade) {
  return {
    id: t.id,
    botPositionId: t.botPositionId,
    exchange: t.exchange,
    symbol: t.symbol,
    entryValue: String(t.entryValue),
    exitValue: String(t.exitValue),
    qty: String(t.qty),
    avgEntryPrice: String(t.avgEntryPrice),
    exitPrice: String(t.exitPrice),
    pnl: String(t.pnl),
    pnlPercent: String(t.pnlPercent),
    addsCount: t.addsCount,
    closeReason: t.closeReason,
    openedAt: iso(t.openedAt),
    closedAt: iso(t.closedAt),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

function deriveCloseReason(orders: Array<{ kind: string; side: string; status: string }>): CloseReason {
  const filledSellTp = orders.some(
    (o) => upper(o.kind) === "TP" && upper(o.side) === "SELL" && isFilledStatus(o.status)
  );
  if (filledSellTp) return "TP";
  return "MANUAL";
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const now = new Date();

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const recentTakeRaw = Number(url.searchParams.get("recentTake") || "20");
    const recentTake = Math.max(
      1,
      Math.min(200, Number.isFinite(recentTakeRaw) ? recentTakeRaw : 20)
    );

    const from =
      parseDateOrNull(fromParam) ??
      startOfUtcDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

    const to = parseDateOrNull(toParam) ?? endOfUtcDay(now);

    const [openPositions, allClosedPositions, rangedClosedPositions] = await Promise.all([
      prisma.botPosition.findMany({
        where: {
          userId: user.id,
          status: "OPEN",
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          userId: true,
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

      prisma.botPosition.findMany({
        where: {
          userId: user.id,
          OR: [{ status: "CLOSED" }, { closedAt: { not: null } }],
        },
        orderBy: { closedAt: "desc" },
        select: {
          id: true,
          exchange: true,
          symbol: true,
          status: true,
          avgPrice: true,
          qty: true,
          addsCount: true,
          investedQuote: true,
          openedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.botPosition.findMany({
        where: {
          userId: user.id,
          OR: [{ status: "CLOSED" }, { closedAt: { not: null } }],
          closedAt: {
            gte: from,
            lte: to,
          },
        },
        orderBy: { closedAt: "desc" },
        select: {
          id: true,
          exchange: true,
          symbol: true,
          status: true,
          avgPrice: true,
          qty: true,
          addsCount: true,
          investedQuote: true,
          openedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const closedPositionIds = Array.from(
      new Set([...allClosedPositions, ...rangedClosedPositions].map((p) => p.id))
    );

    const orders = closedPositionIds.length
      ? await prisma.botOrder.findMany({
          where: {
            userId: user.id,
            botPositionId: { in: closedPositionIds },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            botPositionId: true,
            kind: true,
            side: true,
            status: true,
            price: true,
            qty: true,
            filledAt: true,
            createdAt: true,
          },
        })
      : [];

    const ordersByPosition = new Map<string, typeof orders>();
    for (const order of orders) {
      const key = order.botPositionId || "";
      if (!key) continue;
      const list = ordersByPosition.get(key) ?? [];
      list.push(order);
      ordersByPosition.set(key, list);
    }

    const buildDerivedTrade = (
      p: (typeof allClosedPositions)[number]
    ): DerivedTrade => {
      const positionOrders = ordersByPosition.get(p.id) ?? [];

      const filledBuyOrders = positionOrders.filter(
        (o) => upper(o.side) === "BUY" && isFilledStatus(o.status)
      );
      const filledSellOrders = positionOrders.filter(
        (o) => upper(o.side) === "SELL" && isFilledStatus(o.status)
      );

      const buyQty = filledBuyOrders.reduce((sum, o) => sum + toNum(o.qty), 0);
      const sellQty = filledSellOrders.reduce((sum, o) => sum + toNum(o.qty), 0);

      const entryValueFromOrders = filledBuyOrders.reduce(
        (sum, o) => sum + toNum(o.qty) * toNum(o.price),
        0
      );

      const exitValueFromOrders = filledSellOrders.reduce(
        (sum, o) => sum + toNum(o.qty) * toNum(o.price),
        0
      );

      const fallbackQty = toNum(p.qty);
      const fallbackAvgPrice = toNum(p.avgPrice);
      const fallbackEntryValue = toNum(p.investedQuote);

      const qty = buyQty > 0 ? buyQty : fallbackQty;
      const entryValue =
        entryValueFromOrders > 0
          ? entryValueFromOrders
          : fallbackEntryValue > 0
            ? fallbackEntryValue
            : fallbackAvgPrice * fallbackQty;

      const avgEntryPrice =
        qty > 0
          ? entryValue / qty
          : fallbackAvgPrice;

      const exitQty = sellQty > 0 ? sellQty : qty;
      const exitValue = exitValueFromOrders;
      const exitPrice =
        exitQty > 0 && exitValue > 0 ? exitValue / exitQty : 0;

      const pnl = exitValue - entryValue;
      const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

      return {
        id: p.id,
        botPositionId: p.id,
        exchange: String(p.exchange),
        symbol: p.symbol,
        entryValue,
        exitValue,
        qty,
        avgEntryPrice,
        exitPrice,
        pnl,
        pnlPercent,
        addsCount: p.addsCount ?? 0,
        closeReason: deriveCloseReason(positionOrders),
        openedAt: p.openedAt,
        closedAt: p.closedAt ?? p.updatedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    };

    const allTrades = allClosedPositions.map(buildDerivedTrade);
    const rangedTrades = rangedClosedPositions.map(buildDerivedTrade);
    const recentTrades = rangedTrades.slice(0, recentTake);

    const capitalInWork = openPositions.reduce((s, p) => s + toNum(p.investedQuote), 0);
    const totalPnlAll = allTrades.reduce((s, t) => s + toNum(t.pnl), 0);

    const todayStart = startOfUtcDay(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayTrades = allTrades.filter((t) => t.closedAt >= todayStart);
    const pnlToday = todayTrades.reduce((s, t) => s + toNum(t.pnl), 0);

    const trades7d = allTrades.filter((t) => t.closedAt >= sevenDaysAgo);
    const pnl7d = trades7d.reduce((s, t) => s + toNum(t.pnl), 0);

    const trades30d = allTrades.filter((t) => t.closedAt >= thirtyDaysAgo);
    const pnl30d = trades30d.reduce((s, t) => s + toNum(t.pnl), 0);

    const pnlList = rangedTrades.map((t) => toNum(t.pnl));
    const wins = pnlList.filter((n) => n > 0);
    const losses = pnlList.filter((n) => n < 0);

    const totalPnl = pnlList.reduce((a, b) => a + b, 0);
    const closedTrades = rangedTrades.length;
    const profitableTrades = wins.length;
    const losingTrades = losses.length;

    const winRate = closedTrades ? (profitableTrades / closedTrades) * 100 : 0;
    const avgTradePnl = closedTrades ? totalPnl / closedTrades : 0;

    const bestTradePnl = pnlList.length ? Math.max(...pnlList) : 0;
    const worstTradePnl = pnlList.length ? Math.min(...pnlList) : 0;

    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor =
      grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? 999 : 0;

    const winningTrades = rangedTrades.filter((t) => toNum(t.pnl) > 0);
    const losingTradesRows = rangedTrades.filter((t) => toNum(t.pnl) < 0);

    const maxProfitTrade = winningTrades.length
      ? Math.max(...winningTrades.map((t) => toNum(t.pnl)))
      : 0;

    const minProfitTrade = winningTrades.length
      ? Math.min(...winningTrades.map((t) => toNum(t.pnl)))
      : 0;

    const avgProfitTrade = winningTrades.length
      ? winningTrades.reduce((sum, t) => sum + toNum(t.pnl), 0) / winningTrades.length
      : 0;

    const maxLossTrade = losingTradesRows.length
      ? Math.min(...losingTradesRows.map((t) => toNum(t.pnl)))
      : 0;

    const minLossTrade = losingTradesRows.length
      ? Math.max(...losingTradesRows.map((t) => toNum(t.pnl)))
      : 0;

    const avgLossTrade = losingTradesRows.length
      ? losingTradesRows.reduce((sum, t) => sum + Math.abs(toNum(t.pnl)), 0) /
        losingTradesRows.length
      : 0;

    const durations = rangedTrades
      .map((t) => {
        const opened = new Date(t.openedAt).getTime();
        const closed = new Date(t.closedAt).getTime();
        const diff = closed - opened;
        return Number.isFinite(diff) && diff > 0 ? diff : 0;
      })
      .filter((v) => v > 0);

    const avgDurationMs = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const minDurationMs = durations.length ? Math.min(...durations) : 0;
    const maxDurationMs = durations.length ? Math.max(...durations) : 0;

    let equity = 0;
    let maxBalanceSeen = 0;
    let maxProfitSeries = 0;
    let maxLossSeries = 0;

    const rangedTradesAsc = rangedTrades
      .slice()
      .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());

    for (const t of rangedTradesAsc) {
      const pnl = toNum(t.pnl);
      equity += pnl;

      if (equity > maxBalanceSeen) maxBalanceSeen = equity;
      if (pnl > maxProfitSeries) maxProfitSeries = pnl;
      if (pnl < maxLossSeries) maxLossSeries = pnl;
    }

    return NextResponse.json({
      ok: true,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      stats: {
        totalPnl,
        totalPnlAll,
        pnlToday,
        pnl7d,
        pnl30d,

        openPositions: openPositions.length,
        capitalInWork,

        closedTrades,
        profitableTrades,
        losingTrades,
        winRate,
        avgTradePnl,
        profitFactor,

        bestTradePnl,
        worstTradePnl,

        maxProfitTrade,
        minProfitTrade,
        avgProfitTrade,

        maxLossTrade,
        minLossTrade,
        avgLossTrade,

        avgDurationMs,
        minDurationMs,
        maxDurationMs,

        grossProfit,
        grossLossAbs,

        maxBalanceSeen,
        maxProfitSeries,
        maxLossSeries,
      },
      openPositions: openPositions.map((p) => ({
        ...p,
        avgPrice: String(p.avgPrice ?? "0"),
        qty: String(p.qty ?? "0"),
        tpPrice: String(p.tpPrice ?? "0"),
        investedQuote: String(p.investedQuote ?? "0"),
        openedAt: iso(p.openedAt),
        closedAt: iso(p.closedAt),
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      })),
      recentTrades: recentTrades.map(mapTrade),
      rangedTradesCount: rangedTrades.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}