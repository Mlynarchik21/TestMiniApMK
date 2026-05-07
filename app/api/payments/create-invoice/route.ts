// app/api/payments/create-invoice/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

const PLANS = {
  basic: { stars: 100,  title: "Basic Plan — 1 месяц",  description: "Доступ к базовым функциям бота на 1 месяц" },
  pro:   { stars: 2500, title: "Pro Plan — 1 месяц",    description: "Полный доступ ко всем функциям бота на 1 месяц" },
  vip:   { stars: 250,  title: "VIP Канал — 1 месяц",   description: "Доступ к закрытому VIP каналу с аналитикой на 1 месяц" },
} as const;

type Plan = keyof typeof PLANS;

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const plan = (body?.plan ?? "") as Plan;

    if (!PLANS[plan]) {
      return fail(400, "INVALID_PLAN", "Plan must be basic, pro, or vip");
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return fail(500, "BOT_TOKEN_MISSING");

    const { stars, title, description } = PLANS[plan];
    const payload = JSON.stringify({ plan, userId: user.id });

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        payload,
        currency: "XTR",
        prices: [{ label: title, amount: stars }],
      }),
    });

    const tgJson = await tgRes.json().catch(() => null);
    if (!tgJson?.ok) {
      return fail(500, "TELEGRAM_ERROR", tgJson?.description || "Failed to create invoice");
    }

    return ok({ invoiceLink: tgJson.result, plan, stars });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
