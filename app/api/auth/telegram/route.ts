import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { verifyTelegramInitData } from "@/lib/telegram";

function randomToken() {
  // 32 байта -> base64url
  return crypto.randomBytes(32).toString("base64url");
}

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const { initData } = await req.json().catch(() => ({ initData: "" }));

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN is missing" },
      { status: 500 }
    );
  }

  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ ok: false, error: "initData required" }, { status: 400 });
  }

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified || !verified.user?.id) {
    return NextResponse.json({ ok: false, error: "invalid initData" }, { status: 401 });
  }

  const tgId = BigInt(verified.user.id);

  // upsert user
const user = await prisma.user.upsert({
  where: { tgId: String(tgId) },
  update: {
    username: verified.user.username ?? null,
    firstName: verified.user.first_name ?? null,
    lastName: verified.user.last_name ?? null,
  },
  create: {
    tgId: String(tgId),
    username: verified.user.username ?? null,
    firstName: verified.user.first_name ?? null,
    lastName: verified.user.last_name ?? null,
  },
});

  // create session
  const token = randomToken();
  const tokenHash = sha256hex(token);

  const ttlDays = Number(process.env.SESSION_TTL_DAYS || "30");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const res = NextResponse.json({ ok: true });

  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return res;
}
