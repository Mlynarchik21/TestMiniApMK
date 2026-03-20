import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { notifyTradeClosed } from "@/lib/notifications/telegram";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    await notifyTradeClosed({
      userId: user.id,
      symbol: "BTCUSDT",
      positionId: "test_position_12345678",
      avgEntryPrice: 50000,
      exitPrice: 51000,
      qty: 0.01,
      entryValue: 500,
      exitValue: 510,
      pnl: 10,
    });

    return NextResponse.json({ ok: true, message: "sent" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}