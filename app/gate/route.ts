import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = (params.get("hash") || "").toLowerCase();
  params.delete("hash");

  const keys = Array.from(params.keys()).sort();
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(`${k}=${params.get(k) ?? ""}`);
  }

  return { hash, dataCheckString: parts.join("\n"), params };
}

function validateTelegramInitData(initData: string, botToken: string) {
  const { hash, dataCheckString, params } = parseInitData(initData);
  if (!hash) return { ok: false as const, error: "BAD_INITDATA" as const };

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex")
    .toLowerCase();

  // timing-safe compare
  try {
    const a = Buffer.from(computedHash, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false as const, error: "BAD_INITDATA" as const };
    }
  } catch {
    return { ok: false as const, error: "BAD_INITDATA" as const };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false as const, error: "BAD_INITDATA" as const };

  let user: any = null;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false as const, error: "BAD_INITDATA" as const };
  }

  if (!user?.id) return { ok: false as const, error: "BAD_INITDATA" as const };

  return { ok: true as const, user };
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signSession(payload: object, secret: string) {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

async function getChatMemberStatus(botToken: string, channelId: string, userId: number) {
  const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(
    channelId
  )}&user_id=${encodeURIComponent(String(userId))}`;

  const r = await fetch(url, { method: "GET" });
  const j = await r.json().catch(() => null);

  if (!r.ok || !j || !j.ok) {
    // Если бот не админ/не видит канал — тут чаще всего будут ошибки.
    // Для gate будем считать, что доступа нет.
    return { ok: false as const, status: "unknown" as const, raw: j };
  }

  const status = j?.result?.status as string | undefined;
  return { ok: true as const, status: status || "unknown" };
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    const inviteUrl = process.env.TELEGRAM_CHANNEL_INVITE_URL || null;
    const sessionSecret = process.env.APP_SESSION_SECRET;

    if (!botToken || !channelId || !sessionSecret) {
      return NextResponse.json(
        { ok: false, error: "SERVER_MISCONFIGURED" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const initData = body?.initData;

    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ ok: false, error: "MISSING_INITDATA" }, { status: 400 });
    }

    const v = validateTelegramInitData(initData, botToken);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 401 });
    }

    const userId = Number(v.user.id);

    // Проверка подписки (приватный канал -> нужен channelId вида -100...)
    const member = await getChatMemberStatus(botToken, channelId, userId);

    const allowedStatuses = new Set(["member", "administrator", "creator"]);
    const isSubscribed = member.ok && allowedStatuses.has(member.status);

    if (!isSubscribed) {
      return NextResponse.json(
        { ok: false, error: "NOT_SUBSCRIBED", inviteUrl },
        { status: 403 }
      );
    }

    // Сессия cookie (httpOnly)
    const token = signSession(
      { uid: userId, iat: Date.now() },
      sessionSecret
    );

    const res = NextResponse.json({
      ok: true,
      allowed: true,
      user: {
        id: userId,
        username: v.user.username ?? null,
        first_name: v.user.first_name ?? null,
        last_name: v.user.last_name ?? null,
      },
    });

    res.cookies.set({
      name: "tm_session",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      // 30 дней
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "UNKNOWN", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
