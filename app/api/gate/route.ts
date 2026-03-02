// app/api/gate/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

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
    return {
      ok: false as const,
      error: j?.description || "getChatMember failed",
    };
  }

  const status = j.result?.status as string | undefined;
  const subscribed =
    status === "member" || status === "administrator" || status === "creator";

  return { ok: true as const, subscribed, status };
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// 32 bytes -> hex string (64 chars)
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.BOT_TOKEN;
    const channelId = process.env.CHANNEL_ID;
    const joinUrl = process.env.CHANNEL_JOIN_URL || "";

    const ttlDaysRaw = Number(process.env.SESSION_TTL_DAYS || 30);
    const ttlDays =
      Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : 30;

    if (!botToken) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 });
    }
    if (!channelId) {
      return NextResponse.json({ ok: false, error: "CHANNEL_ID missing" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const initData = String(body?.initData || "");
    if (!initData) {
      return NextResponse.json({ ok: false, error: "initData empty" }, { status: 400 });
    }

    // 1) validate initData
    const v = verifyTelegramInitData(initData, botToken);
    if (!v.ok) {
      return NextResponse.json(
        { ok: false, error: `initData_${v.reason}` },
        { status: 401 }
      );
    }

    // tg id as number for Telegram API call
    const tgIdNumber = Number(v.user.id);
    if (!Number.isFinite(tgIdNumber)) {
      return NextResponse.json({ ok: false, error: "bad_tg_id" }, { status: 400 });
    }

    // ✅ tgId for Prisma as BigInt (User.tgId = BigInt)
    const tgId = BigInt(v.user.id);

    // 2) subscription check
    const sub = await isSubscribed(botToken, channelId, tgIdNumber);
    if (!sub.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            sub.error +
            " (проверь: бот должен быть админом канала + правильный CHANNEL_ID)",
        },
        { status: 500 }
      );
    }

    if (!sub.subscribed) {
      return NextResponse.json({ ok: true, subscribed: false, joinUrl });
    }

    // 3) upsert user (BigInt!)
    const username = typeof v.user.username === "string" ? v.user.username : null;
    const firstName = typeof v.user.first_name === "string" ? v.user.first_name : null;
    const lastName = typeof v.user.last_name === "string" ? v.user.last_name : null;

    const user = await prisma.user.upsert({
      where: { tgId },
      create: { tgId, username, firstName, lastName },
      update: { username, firstName, lastName },
      select: { id: true, tgId: true, username: true, firstName: true, lastName: true },
    });

    // 4) create session (store hash in DB, return raw token to client)
    const rawToken = randomToken(32);
    const tokenHash = sha256Hex(rawToken);

    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    // 5) response (+ optional cookie)
    const res = NextResponse.json({
      ok: true,
      subscribed: true,
      sessionToken: rawToken,
      user: {
        tgId: tgIdNumber, // для фронта оставляем number
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    // В Telegram cookie часто не работают — но пусть будет.
    res.cookies.set("session", rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: ttlDays * 24 * 60 * 60,
    });

    res.cookies.set("tm_uid", "", { path: "/", maxAge: 0 });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
