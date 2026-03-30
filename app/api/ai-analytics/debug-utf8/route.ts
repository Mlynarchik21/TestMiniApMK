import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    plain: "Смешанный рынок / переходная фаза",
    unicodeEscaped:
      "\u0421\u043c\u0435\u0448\u0430\u043d\u043d\u044b\u0439 \u0440\u044b\u043d\u043e\u043a / \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u043d\u0430\u044f \u0444\u0430\u0437\u0430",
    rotation: "Ротация в ETH и альткоины",
    support: "Поддержка слабая / нейтральная",
  });
}