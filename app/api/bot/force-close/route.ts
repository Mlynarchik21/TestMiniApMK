import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data?: any) {
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

function fail(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const now = new Date();

    const openPositions = await prisma.botPosition.findMany({
      where: {
        userId: user.id,
        status: "OPEN",
      },
    });

    if (!openPositions.length) {
      return ok({ closed: 0, deletedTrades: 0 });
    }

    for (const p of openPositions) {
      const exitValue = Number(p.investedQuote ?? 0);

      await prisma.botTrade.create({
        data: {
          userId: user.id,
          botPositionId: p.id,
          exchange: p.exchange,
          symbol: p.symbol,

          entryValue: p.investedQuote ?? 0,
          exitValue,

          qty: p.qty ?? 0,
          avgEntryPrice: p.avgPrice ?? 0,
          exitPrice: p.avgPrice ?? 0,

          pnl: 0,
          pnlPercent: 0,

          addsCount: p.addsCount ?? 0,

          openedAt: p.openedAt,
          closedAt: now,
        },
      });

      await prisma.botPosition.update({
        where: { id: p.id },
        data: {
          status: "CLOSED",
          closedAt: now,
        },
      });
    }

    const deletedTrades = await prisma.botTrade.deleteMany({
      where: { userId: user.id },
    });

    return ok({
      closed: openPositions.length,
      deletedTrades: deletedTrades.count,
    });
  } catch (e: any) {
    return fail(500, "SERVER_ERROR", e?.message ?? String(e));
  }
}