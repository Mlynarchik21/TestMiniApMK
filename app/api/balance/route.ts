// app/api/balance/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

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

function hmacSHA256Hex(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function binanceSpotBalance(apiKey: string, apiSecret: string) {
  const base = "https://api.binance.com";
  const path = "/api/v3/account";

  const timestamp = Date.now();
  const recvWindow = 5000;

  const qs = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
  const signature = hmacSHA256Hex(apiSecret, qs);

  const url = `${base}${path}?${qs}&signature=${signature}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    cache: "no-store",
  });

  const j = await r.json().catch(() => null);

  if (!r.ok) {
    return { ok: false as const, status: r.status, error: j?.msg || "BINANCE_ERROR", raw: j };
  }

  // j.balances: [{ asset, free, locked }]
  const balances = Array.isArray(j?.balances) ? j.balances : [];
  const nonZero = balances
    .map((b: any) => ({
      asset: String(b.asset || ""),
      free: String(b.free || "0"),
      locked: String(b.locked || "0"),
    }))
    .filter((b: any) => Number(b.free) > 0 || Number(b.locked) > 0);

  return {
    ok: true as const,
    exchange: "BINANCE",
    accountType: "SPOT",
    nonZero,
    raw: { makerCommission: j?.makerCommission, takerCommission: j?.takerCommission },
  };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const { searchParams } = new URL(req.url);

    const keyId = String(searchParams.get("keyId") || "").trim();
    if (!keyId) return json({ ok: false, error: "BAD_REQUEST", message: "keyId required" }, { status: 400 });

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

    if (!key) return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    // пока делаем реальную проверку на Binance Spot
    if (key.exchange !== "BINANCE") {
      return json(
        {
          ok: false,
          error: "NOT_IMPLEMENTED",
          message: "Balance check implemented for BINANCE only (for now).",
          exchange: key.exchange,
        },
        { status: 400 }
      );
    }

    const apiKey = key.apiKey;
    const apiSecret = decryptString(key.secretEnc);

    const bal = await binanceSpotBalance(apiKey, apiSecret);
    if (!bal.ok) {
      return json(
        {
          ok: false,
          error: "EXCHANGE_ERROR",
          exchange: key.exchange,
          status: bal.status,
          message: bal.error,
          raw: bal.raw,
        },
        { status: 400 }
      );
    }

    return json({
      ok: true,
      key: { id: key.id, exchange: key.exchange, label: key.label },
      balance: bal,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
