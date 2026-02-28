import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false as const, reason: "no_hash" };

  params.delete("hash");

  const arr: string[] = [];
  params.forEach((v, k) => arr.push(`${k}=${v}`));
  arr.sort();
  const dataCheckString = arr.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (hmac !== hash) return { ok: false as const, reason: "bad_hash" };

  const userStr = params.get("user");
  if (!userStr) return { ok: false as const, reason: "no_user" };

  let user: any;
  try {
    user = JSON.parse(userStr);
  } catch {
    return { ok: false as const, reason: "bad_user_json" };
  }

  if (!user?.id) return { ok: false as const, reason: "no_user_id" };

  return { ok: true as const, user };
}

async function isSubscribed(botToken: string, channelId: string, userId: number) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(
    channelId
  )}&user_id=${userId}`;

  const r = await fetch(url, { method: "GET" });
  const j = await r.json().catch(() => null);

  if (!j?.ok) {
    // если бот не админ в канале или неверный channelId — тут будет ошибка
    return { ok: false as const, error: j?.description || "getChatMember failed" };
  }

  const status = j.result?.status as string | undefined;
  const subscribed =
    status === "member" || status === "administrator" || status === "creator";

  return { ok: true as const, subscribed, status };
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.BOT_TOKEN;
    const channelId = process.env.CHANNEL_ID;
    const joinUrl = process.env.CHANNEL_JOIN_URL || "";

    if (!botToken) return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" });
    if (!channelId) return NextResponse.json({ ok: false, error: "CHANNEL_ID missing" });

    const body = await req.json().catch(() => null);
    const initData = String(body?.initData || "");
    if (!initData) return NextResponse.json({ ok: false, error: "initData empty" });

    const v = verifyTelegramInitData(initData, botToken);
    if (!v.ok) return NextResponse.json({ ok: false, error: `initData_${v.reason}` });

    const userId = Number(v.user.id);

    const sub = await isSubscribed(botToken, channelId, userId);
    if (!sub.ok) {
      return NextResponse.json({
        ok: false,
        error: sub.error + " (проверь: бот должен быть админом канала + правильный CHANNEL_ID)"
      });
    }

    const res = NextResponse.json({
      ok: true,
      subscribed: sub.subscribed,
      joinUrl
    });

    // приватная cookie (пример) — можно расширить позже
    res.cookies.set("tm_uid", String(userId), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) });
  }
}
