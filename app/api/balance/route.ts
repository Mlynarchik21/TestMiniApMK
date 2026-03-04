// app/api/balance/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

function ok(data: any) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status }
  );
}

function sign(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function binanceSpotAccount(apiKey: string, apiSecret: string) {
  const base = "https://api.binance.com";
  const timestamp = Date.now();
  const recvWindow = 10_000;

  const qs = new URLSearchParams({
    timestamp: String(timestamp),
    recvWindow: String(recvWindow),
  }).toString();

  const signature = sign(qs, apiSecret);
  const url = `${base}/api/v3/account?${qs}&signature=${signature}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    cache: "no-store",
  });

  const text = await r.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!r.ok) {
    const msg = json?.msg || text || `Binance error: ${r.status}`;
    throw new Error(msg);
  }

  return json;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = (url.searchParams.get("keyId") || "").trim();
    if (!keyId) return fail(400, "BAD_REQUEST", "keyId required");

    const key = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,
        label: true,
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,
      },
    });

    if (!key) return fail(404, "NOT_FOUND", "key not found");

    if (key.exchange !== "BINANCE") {
      return fail(400, "UNSUPPORTED_EXCHANGE", "Only BINANCE spot supported now");
    }

    const apiSecret = decryptString(key.secretEnc);

    const account = await binanceSpotAccount(key.apiKey, apiSecret);

    // Binance отдаёт balances: [{asset, free, locked}, ...]
    const balances = Array.isArray(account?.balances) ? account.balances : [];

    // отфильтруем нулевые, чтобы было читабельно
    const nonZero = balances.filter((b: any) => {
      const free = Number(b?.free || 0);
      const locked = Number(b?.locked || 0);
      return free !== 0 || locked !== 0;
    });

    return ok({
      exchange: "BINANCE",
      keyId: key.id,
      label: key.label ?? null,
      balances: nonZero,
      raw: { canTrade: account?.canTrade, accountType: account?.accountType },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}