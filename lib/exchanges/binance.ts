// lib/exchanges/binance.ts
import crypto from "crypto";

function hmacSha256Hex(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Binance Spot Account Info
 * https://api.binance.com/api/v3/account
 */
export async function fetchBinanceBalances(apiKey: string, apiSecret: string) {
  const baseUrl = "https://api.binance.com";
  const ts = Date.now();
  const query = `timestamp=${ts}`;
  const signature = hmacSha256Hex(apiSecret, query);

  const url = `${baseUrl}/api/v3/account?${query}&signature=${signature}`;

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
    .filter((b: any) => Number(b.free) > 0 || Number(b.locked) > 0);

  return {
    ok: true as const,
    balances: nonZero,
  };
}
