import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const userId = "cmm94hwra0001o4jlmbosv8ag";
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tgId: true, username: true },
  });

  if (!botToken) {
    return NextResponse.json({
      ok: false,
      step: "ENV_CHECK",
      error: "TELEGRAM_BOT_TOKEN_MISSING",
    });
  }

  if (!user?.tgId) {
    return NextResponse.json({
      ok: false,
      step: "USER_CHECK",
      error: "TG_ID_MISSING",
      user,
    });
  }

  const text =
    `Тест Telegram\n\n` +
    `userId: ${user.id}\n` +
    `tgId: ${user.tgId}\n` +
    `username: ${user.username ?? "-"}\n` +
    `time: ${new Date().toISOString()}`;

  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: String(user.tgId),
      text,
    }),
    cache: "no-store",
  });

  const rawText = await r.text();

  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {}

  return NextResponse.json({
    ok: r.ok,
    httpStatus: r.status,
    envTokenExists: !!botToken,
    envTokenPreview: `${botToken.slice(0, 8)}...${botToken.slice(-6)}`,
    user,
    telegramResponse: json ?? rawText,
  });
}