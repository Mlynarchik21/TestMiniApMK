import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

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

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startOfDayUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function daysAgoUtc(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const todayStart = startOfDayUtc();
    const sevenDaysAgo = daysAgoUtc(7);
    const thirtyDaysAgo = daysAgoUtc(30);

    const [openPositions, recentTrades, allTrades] = await Promise.all([
      prisma.botPosition.findMany({
        where: {
          userId: user.id,
          status: "OPEN",
        },
        select: {
          id: true,
          symbol: true,
          avgPrice: true,
          qty: true,
          tpPrice: true,
          investedQuote: true,
          addsCount: true,
          openedAt: true,
        },
        orderBy: { openedAt: "desc" },
      }),

      prisma.botTrade.findMany({
        where: {
          userId: user.id,
        },
        orderBy: { closedAt: "desc" },
        take: 20,
        select: {
          id: true,
          symbol: true,
          exchange: true,
          entryValue: true,
          exitValue: true,
          qty: true,
          avgEntryPrice: true,
          exitPrice: true,
          pnl: true,
          pnlPercent: true,
          addsCount: true,
          closeReason: true,
          openedAt: true,
          closedAt: true,
          createdAt: true,
        },
      }),

      prisma.botTrade.findMany({
        where: {
          userId: user.id,
        },
        orderBy: { closedAt: "desc" },
        select: {
          id: true,
          pnl: true,
          pnlPercent: true,
          entryValue: true,
          closedAt: true,
        },
      }),
    ]);

    const totalPnl = allTrades.reduce((s, t) => s + toNum(t.pnl), 0);

    const todayTrades = allTrades.filter((t) => new Date(t.closedAt) >= todayStart);
    const pnlToday = todayTrades.reduce((s, t) => s + toNum(t.pnl), 0);

    const trades7d = allTrades.filter((t) => new Date(t.closedAt) >= sevenDaysAgo);
    const pnl7d = trades7d.reduce((s, t) => s + toNum(t.pnl), 0);

    const trades30d = allTrades.filter((t) => new Date(t.closedAt) >= thirtyDaysAgo);
    const pnl30d = trades30d.reduce((s, t) => s + toNum(t.pnl), 0);

    const closedTrades = allTrades.length;
    const profitableTrades = allTrades.filter((t) => toNum(t.pnl) > 0).length;
    const losingTrades = allTrades.filter((t) => toNum(t.pnl) < 0).length;

    const winRate = closedTrades > 0 ? (profitableTrades / closedTrades) * 100 : 0;

    const avgTradePnl = closedTrades > 0 ? totalPnl / closedTrades : 0;

    const bestTrade = allTrades.reduce((best, t) => {
      if (!best) return t;
      return toNum(t.pnl) > toNum(best.pnl) ? t : best;
    }, null as null | (typeof allTrades)[number]);

    const worstTrade = allTrades.reduce((worst, t) => {
      if (!worst) return t;
      return toNum(t.pnl) < toNum(worst.pnl) ? t : worst;
    }, null as null | (typeof allTrades)[number]);

    const capitalInWork = openPositions.reduce((s, p) => s + toNum(p.investedQuote), 0);

    return ok({
      stats: {
        totalPnl,
        pnlToday,
        pnl7d,
        pnl30d,
        openPositions: openPositions.length,
        closedTrades,
        profitableTrades,
        losingTrades,
        winRate,
        avgTradePnl,
        capitalInWork,
        bestTradePnl: bestTrade ? toNum(bestTrade.pnl) : 0,
        worstTradePnl: worstTrade ? toNum(worstTrade.pnl) : 0,
      },
      openPositions: openPositions.map((p) => ({
        ...p,
        avgPrice: p.avgPrice.toString(),
        qty: p.qty.toString(),
        tpPrice: p.tpPrice.toString(),
        investedQuote: p.investedQuote.toString(),
      })),
      recentTrades: recentTrades.map((t) => ({
        ...t,
        entryValue: t.entryValue.toString(),
        exitValue: t.exitValue.toString(),
        qty: t.qty.toString(),
        avgEntryPrice: t.avgEntryPrice.toString(),
        exitPrice: t.exitPrice.toString(),
        pnl: t.pnl.toString(),
        pnlPercent: t.pnlPercent.toString(),
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