import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startOfDayUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const todayStart = startOfDayUtc();
    const sevenDaysAgo = daysAgo(7);
    const thirtyDaysAgo = daysAgo(30);

    const [openPositions, recentTrades, allTrades] = await Promise.all([
      prisma.botPosition.findMany({
        where: { userId: user.id, status: "OPEN" },
      }),
      prisma.botTrade.findMany({
        where: { userId: user.id },
        orderBy: { closedAt: "desc" },
        take: 20,
      }),
      prisma.botTrade.findMany({
        where: { userId: user.id },
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

    const winRate = closedTrades ? (profitableTrades / closedTrades) * 100 : 0;
    const avgTradePnl = closedTrades ? totalPnl / closedTrades : 0;

    const capitalInWork = openPositions.reduce((s, p) => s + toNum(p.investedQuote), 0);

    return NextResponse.json({
      ok: true,
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
      },
      openPositions,
      recentTrades,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
