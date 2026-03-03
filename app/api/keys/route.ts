// app/api/keys/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { encryptString, decryptString } from "@/lib/crypto/secretBox";
import { Exchange } from "@prisma/client";
import { fetchBinanceBalances } from "@/lib/exchanges/binance";

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

function fail(status: number, error: string, message?: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ? { extra } : {}) },
    { status }
  );
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

    if (!body?.exchange) return fail(400, "BAD_REQUEST", "exchange required");
    if (!body?.apiKey) return fail(400, "BAD_REQUEST", "apiKey required");
    if (!body?.apiSecret) return fail(400, "BAD_REQUEST", "apiSecret required");

    const label =
      typeof body.label === "string" && body.label.trim().length
        ? body.label.trim().slice(0, 64)
        : null;

    // 1) ищем существующий ключ по (userId, exchange, label)
    const existing = await prisma.userKey.findFirst({
      where: { userId: user.id, exchange: body.exchange, label },
      select: { id: true },
    });

    const enc = {
      apiKeyEnc: encryptString(body.apiKey),
      apiSecretEnc: encryptString(body.apiSecret),
      passphraseEnc: body.passphrase ? encryptString(body.passphrase) : null,
    };

    // 2) update или create
    const row = existing
      ? await prisma.userKey.update({
          where: { id: existing.id },
          data: enc,
          select: { id: true, exchange: true, label: true, createdAt: true, updatedAt: true },
        })
      : await prisma.userKey.create({
          data: {
            // ✅ важно: создаём через relation connect, чтобы не ловить "userId: never"
            user: { connect: { id: user.id } },
            exchange: body.exchange,
            label,
            ...enc,
          },
          select: { id: true, exchange: true, label: true, createdAt: true, updatedAt: true },
        });

    // 3) проверка ключей — баланс (пока только BINANCE)
    let balance: any = null;

    if (row.exchange === "BINANCE") {
      const apiKey = decryptString(enc.apiKeyEnc);
      const apiSecret = decryptString(enc.apiSecretEnc);

      const b = await fetchBinanceBalances(apiKey, apiSecret);
      balance = b.ok ? { exchange: "BINANCE", balances: b.balances } : { exchange: "BINANCE", ...b };
    } else {
      balance = { exchange: row.exchange, ok: false, error: "BALANCE_NOT_IMPLEMENTED_YET" };
    }

    return ok({ key: row, balance });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}
