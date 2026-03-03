// app/api/auth/telegram/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

// 32 bytes -> base64url string
function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ✅ BigInt-safe JSON helper (на будущее)
function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const initData = typeof body?.initData === "string" ? body.initData : "";

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return json({ ok: false, error: "TELEGRAM_BOT_TOKEN is missing" }, { status: 500 });
    }

    if (!initData) {
      return json({ ok: false, error: "initData required" }, { status: 400 });
    }

    const verified = verifyTelegramInitData(initData, botToken);
    if (!verified?.user?.id) {
      return json({ ok: false, error: "invalid initData" }, { status: 401 });
    }

    // ✅ tgId bigint
    let tgId: bigint;
    try {
      tgId = BigInt(verified.user.id);
    } catch {
      return json({ ok: false, error: "bad_tg_id" }, { status: 400 });
    }

    // upsert user
    const user = await prisma.user.upsert({
      where: { tgId },
      update: {
        username: verified.user.username ?? null,
        firstName: verified.user.first_name ?? null,
        lastName: verified.user.last_name ?? null,
      },
      create: {
        tgId,
        username: verified.user.username ?? null,
        firstName: verified.user.first_name ?? null,
        lastName: verified.user.last_name ?? null,
      },
      select: { id: true },
    });

    // create session
    const rawToken = randomToken();          // raw токен (для cookie/Authorization)
    const tokenHash = sha256hex(rawToken);   // hash в БД

    const ttlDays = Number(process.env.SESSION_TTL_DAYS || "30");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    // (опционально) чистим старые сессии этого юзера, чтобы не копились
    // await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    // ВАЖНО: в Telegram cookie может не работать стабильно,
    // поэтому фронт всё равно должен сохранять sessionToken из ответа (если ты так сделал).
    const res = NextResponse.json({ ok: true, sessionToken: rawToken });

    res.cookies.set("session", rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (e: any) {
    return json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
