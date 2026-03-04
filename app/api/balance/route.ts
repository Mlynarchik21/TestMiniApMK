// app/api/balance/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import crypto from "crypto";

export const runtime = "nodejs";

// BigInt-safe JSON
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

function fail(status: number, error: string, message?: string) {
  return json({ ok: false, error, ...(message ? { message } : {}) }, { status });
}

function hmacSha256Hex(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function binanceAccount(apiKey: string, apiSecret: string) {
  const base = "https://api.binance.com";
  const timestamp = Date.now().toString();
  const query = `timestamp=${timestamp}`;
  const signature = hmacSha256Hex(apiSecret, query);

  const url = `${base}/api/v3/account?${query}&signature=${signature}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    cache: "no-store",
  });

  const text = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!r.ok) {
    return {
      ok: false as const,
      status: r.status,
      error: j?.msg || text || "binance_error",
      code: j?.code,
    };
  }

  const balances: Array<{ asset: string; free: string; locked: string }> = Array.isArray(j?.balances)
    ? j.balances
    : [];

  // оставим только ненулевые
  const nonZero = balances.filter((b) => Number(b.free) !== 0 || Number(b.locked) !== 0);

  return { ok: true as const, balances: nonZero };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = (url.searchParams.get("keyId") || "").trim();
    if (!keyId) return fail(400, "BAD_REQUEST", "keyId required");

    // Берём ровно те поля, которые реально есть в Prisma Client сейчас
    const key = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,
        label: true,
      },
    });

    if (!key) return fail(404, "NOT_FOUND");

    const apiKey = decryptString(key.apiKey);
    const apiSecret = decryptString(key.secretEnc);
    const passphrase = key.passphraseEnc ? decryptString(key.passphraseEnc) : null;

    if (key.exchange === "BINANCE") {
      const acc = await binanceAccount(apiKey, apiSecret);
      if (!acc.ok) {
        return fail(400, "EXCHANGE_ERROR", `BINANCE: ${acc.error} (code=${acc.code ?? "n/a"})`);
      }

      return json({
        ok: true,
        exchange: "BINANCE",
        keyId: key.id,
        label: key.label,
        balances: acc.balances,
      });
    }

    // заглушки под будущие биржи
    if (key.exchange === "OKX") {
      return fail(501, "NOT_IMPLEMENTED", "OKX balance not implemented yet");
    }
    if (key.exchange === "BYBIT") {
      return fail(501, "NOT_IMPLEMENTED", "BYBIT balance not implemented yet");
    }

    return fail(400, "BAD_REQUEST", "Unknown exchange");
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}
