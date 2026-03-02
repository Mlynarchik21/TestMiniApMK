// app/api/auth/dev/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Генерация токена без Node `crypto`, через Web Crypto API
function generateTokenBase64Url(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);

  // base64url
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  const base64 = Buffer.from(str, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function POST() {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? "30");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // dev-user (фиксированный tgId)
  const tgId = 999999999n; // <-- ВАЖНО: bigint

  const user = await prisma.user.upsert({
    where: { tgId },
    update: {},
    create: {
      tgId,
      username: "dev",
      firstName: "Dev",
      lastName: "User",
    },
    select: { id: true },
  });

  const token = generateTokenBase64Url(32);

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const res = NextResponse.json({ ok: true });

  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return res;
}
