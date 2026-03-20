import { NextResponse } from "next/server";
import { notifyTradeClosed } from "@/lib/notifications/telegram";

export async function GET() {
  await notifyTradeClosed({
    userId: "cmm94hwra0001o4jlmbosv8ag",
    symbol: "BTCUSDT",
    positionId: "test12345678",
    avgEntryPrice: 50000,
    exitPrice: 51000,
    qty: 0.01,
    entryValue: 500,
    exitValue: 510,
    pnl: 10,
  });

  return NextResponse.json({ ok: true });
}