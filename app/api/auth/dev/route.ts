// app/api/auth/dev/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function generateTokenBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  // SECURITY: Требуем DEV_AUTH_SECRET для доступа к dev endpoint
  const devSecret = process.env.DEV_AUTH_SECRET?.trim();
  
  // Log attempt для отладки (но осторожно - не логируем сам secret)
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  
  // Проверка 1: DEV_AUTH_SECRET должен быть установлен
  if (!devSecret) {
    console.warn(`[DEV_AUTH] Attempt without DEV_AUTH_SECRET configured (IP: ${ip})`);
    return NextResponse.json(
      { ok: false, error: "DEV_AUTH_SECRET not configured" },
      { status: 503 }
    );
  }

  // Проверка 2: Проверяем Authorization header
  const authHeader = req.headers.get("authorization") || "";
  const expectedPrefix = "Bearer ";
  
  if (!authHeader.startsWith(expectedPrefix)) {
    console.warn(`[DEV_AUTH] Missing Bearer token (IP: ${ip})`);
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(expectedPrefix.length).trim();
  
  // Проверка 3: Сравниваем token с secret
  const secretsMatch = token.length === devSecret.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(devSecret));
  if (!secretsMatch) {
    console.warn(`[DEV_AUTH] Invalid dev secret (IP: ${ip})`);
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Проверка 4: Доп. проверка - логируем успешный вход
  console.log(`[DEV_AUTH] Successful dev login (IP: ${ip})`);

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

  const rawToken = generateTokenBase64Url(32);
  const tokenHash = sha256Hex(rawToken);

  await prisma.session.create({
    data: {
      token: tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const res = NextResponse.json({ ok: true });

  res.cookies.set("session", rawToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return res;
}
