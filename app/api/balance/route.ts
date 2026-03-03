// app/api/balance/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { Exchange } from "@prisma/client";

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

function hmacSha256Hex(secret: string, message: string) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

async function binanceAccount(apiKey: string, apiSecret: string) {
  const base = "https://api.binance.com";
  const timestamp = Date.now();
  const recvWindow = 5000;

  const qs = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = hmacSha256Hex(apiSecret, qs);

  const url = `${base}/api/v3/account?${qs}&signature=${signature}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    cache: "no-store",
  });

  const j = await r.json().catch(() => null);

  if (!r.ok) {
    return {
      ok: false as const,
      status: r.status,
      error: j?.msg || j?.message || "BINANCE_ERROR",
      raw: j,
    };
  }

  const balances = Array.isArray(j?.balances) ? j.balances : [];
  const nonZero = balances
    .map((b: any) => ({
      asset: String(b.asset),
      free: String(b.free),
      locked: String(b.locked),
    }))
    .filter((b: any) => Number(b.free) !== 0 || Number(b.locked) !== 0);

  return { ok: true as const, balances: nonZero };
}

export async function GET(req: Request) {
  try {
    const { user } = await requireUser(req);
    const url = new URL(req.url);
    const keyId = (url.searchParams.get("keyId") || "").trim();

    if (!keyId) return json({ ok: false, error: "BAD_REQUEST", message: "keyId required" }, { status: 400 });

    const row = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,
        label: true,
        apiKeyEnc: true,
        apiSecretEnc: true,
        passphraseEnc: true,
      },
    });

    if (!row) return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const apiKey = decryptString(row.apiKeyEnc);
    const apiSecret = decryptString(row.apiSecretEnc);
    const passphrase = row.passphraseEnc ? decryptString(row.passphraseEnc) : null;

    if (row.exchange === Exchange.BINANCE) {
      const b = await binanceAccount(apiKey, apiSecret);
      if (!b.ok) return json({ ok: false, error: "EXCHANGE_ERROR", exchange: row.exchange, ...b }, { status: 502 });
      return json({ ok: true, exchange: row.exchange, keyId: row.id, label: row.label, balances: b.balances });
    }

    // заглушки под другие биржи — добавим позже
    return json({
      ok: false,
      error: "NOT_IMPLEMENTED",
      message: `Balance for ${row.exchange} not implemented yet`,
      exchange: row.exchange,
      hasPassphrase: Boolean(passphrase),
    }, { status: 501 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
