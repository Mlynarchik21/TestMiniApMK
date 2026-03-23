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

    // ❗ удаляем ВСЮ историю сделок
    const deletedTrades = await prisma.botTrade.deleteMany({
      where: { userId: user.id },
    });

    // ❗ если у тебя есть TradeEvent — можно раскомментить
    // await prisma.tradeEvent.deleteMany({
    //   where: { userId: user.id },
    // });

    return ok({
      deletedTrades: deletedTrades.count,
    });
  } catch (e: any) {
    return fail(
      500,
      "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}