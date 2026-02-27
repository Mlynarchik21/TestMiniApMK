import { NextResponse } from "next/server";
import { validateTelegramInitData } from "../../../lib/telegram";

export const runtime = "nodejs";

type Ok = {
  ok: true;
  allowed: true;
  user: { id: number; username?: string | null };
};

type Fail =
  | { ok: false; error: "MISSING_INITDATA" }
  | { ok: false; error: "SERVER_MISCONFIGURED" }
  | { ok: false; error: "BAD_INITDATA" }
  | { ok: false; error: "INITDATA_EXPIRED" }
  | { ok: false; error: "NOT_SUBSCRIBED"; inviteUrl?: string | null }
  | { ok: false; error: "TG_API_ERROR"; message?: string };

async function isSubscribed(botToken: string, channelId: string, userId: number) {
  // Telegram Bot API: getChatMember
  const url =
    `https://api.telegram.org/bot${botToken}/getChatMember` +
    `?chat_id=${encodeURIComponent(channelId)}` +
    `&user_id=${encodeURIComponent(String(userId))}`;

  const r = await fetch(url, { method: "GET" });
  const j: any = await r.json().catch(() => null);

  if (!r.ok || !j || j.ok !== true) {
    return { ok: false as const, message: j?.description || `HTTP ${r.status}` };
  }

  const status = j.result?.status as string | undefined;
  const subscribed = status === "member" || status === "administrator" || status === "creator";
  return { ok: true as const, subscribed, status };
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    const inviteUrl = process.env.TELEGRAM_CHANNEL_INVITE_URL ?? null;

    if (!botToken || !channelId) {
      const out: Fail = { ok: false, error: "SERVER_MISCONFIGURED" };
      return NextResponse.json(out, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const initData = body?.initData as string | undefined;

    if (!initData) {
      const out: Fail = { ok: false, error: "MISSING_INITDATA" };
      return NextResponse.json(out, { status: 400 });
    }

    const v = validateTelegramInitData(initData, botToken);

    if (!v.ok) {
      const out: Fail =
        v.error === "INITDATA_EXPIRED"
          ? { ok: false, error: "INITDATA_EXPIRED" }
          : { ok: false, error: "BAD_INITDATA" };
      return NextResponse.json(out, { status: 401 });
    }

    const userId = Number(v.user.id);

    const sub = await isSubscribed(botToken, channelId, userId);

    if (!sub.ok) {
      const out: Fail = { ok: false, error: "TG_API_ERROR", message: sub.message };
      return NextResponse.json(out, { status: 502 });
    }

    if (!sub.subscribed) {
      const out: Fail = { ok: false, error: "NOT_SUBSCRIBED", inviteUrl };
      return NextResponse.json(out, { status: 403 });
    }

    const out: Ok = {
      ok: true,
      allowed: true,
      user: { id: userId, username: v.user.username ?? null },
    };
    return NextResponse.json(out);
  } catch (e: any) {
    const out: Fail = { ok: false, error: "TG_API_ERROR", message: String(e?.message ?? e) };
    return NextResponse.json(out, { status: 500 });
  }
}
