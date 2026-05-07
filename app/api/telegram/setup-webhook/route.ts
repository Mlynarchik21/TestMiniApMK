// app/api/telegram/setup-webhook/route.ts
// Call this endpoint once to register the Telegram webhook.
// Protected by CRON_SECRET: GET /api/telegram/setup-webhook?secret=YOUR_CRON_SECRET
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const botToken = process.env.BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;

  if (!botToken) return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
  if (!appUrl) return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_APP_URL or VERCEL_URL missing" }, { status: 500 });

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";

  const body: any = { url: webhookUrl };
  if (webhookSecret) body.secret_token = webhookSecret;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  return NextResponse.json({ ok: json?.ok ?? false, result: json, webhookUrl });
}
