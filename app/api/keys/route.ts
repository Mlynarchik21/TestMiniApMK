// app/api/keys/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { encryptString } from "@/lib/crypto/secretBox";
import { Exchange } from "@prisma/client";

export const runtime = "nodejs";

type CreateBody = {
  exchange: Exchange;
  label?: string | null;
  apiKey: string;
  apiSecret: string;
  passphrase?: string | null;
};

function ok(data: any) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status }
  );
}

function normalizeLabel(label: unknown): string | null {
  if (typeof label !== "string") return null;
  const s = label.trim();
  return s.length ? s.slice(0, 64) : null;
}

function isExchange(v: any): v is Exchange {
  return v === "BINANCE" || v === "BYBIT" || v === "OKX";
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const rows = await prisma.userKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        exchange: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({ keys: rows });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;
    if (!body) return fail(400, "BAD_REQUEST", "invalid json");

    if (!isExchange(body.exchange)) return fail(400, "BAD_REQUEST", "exchange required");
    if (typeof body.apiKey !== "string" || !body.apiKey.trim())
      return fail(400, "BAD_REQUEST", "apiKey required");
    if (typeof body.apiSecret !== "string" || !body.apiSecret.trim())
      return fail(400, "BAD_REQUEST", "apiSecret required");

    const label = normalizeLabel(body.label);

    // ВАЖНО: unique у тебя @@unique([userId, exchange, label])
    // Prisma не всегда генерит красивый composite name => делаем вручную:
    const existing = await prisma.userKey.findFirst({
      where: { userId: user.id, exchange: body.exchange, label },
      select: { id: true },
    });

    const payload = {
      apiKeyEnc: encryptString(body.apiKey.trim()),
      apiSecretEnc: encryptString(body.apiSecret.trim()),
      passphraseEnc:
        typeof body.passphrase === "string" && body.passphrase.trim().length
          ? encryptString(body.passphrase.trim())
          : null,
    };

    const row = existing
      ? await prisma.userKey.update({
          where: { id: existing.id },
          data: payload,
          select: {
            id: true,
            exchange: true,
            label: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : await prisma.userKey.create({
          data: {
            userId: user.id,
            exchange: body.exchange,
            label,
            ...payload,
          },
          select: {
            id: true,
            exchange: true,
            label: true,
            createdAt: true,
            updatedAt: true,
          },
        });

    return ok({ key: row });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}
