// app/api/balance/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { getBybitApiPermissions } from "@/lib/exchanges/bybit";

export const runtime = "nodejs";

type AnyJson = any;

function ok(data: AnyJson) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string, extra?: AnyJson) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

function sign(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

function getBinanceBaseUrl(testnet: boolean) {
  return testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
}

/**
 * Если BINANCE_PROXY_URL задан — ходим через прокси (Cloudflare Worker),
 * иначе — напрямую в Binance.
 *
 * Формат прокси: GET {BINANCE_PROXY_URL}?url=<encoded_url>
 * и заголовок: X-Proxy-Token: <PROXY_TOKEN> (если задан)
 */
async function fetchViaOptionalProxy(url: string, init?: RequestInit) {
  const proxy = process.env.BINANCE_PROXY_URL?.trim();
  if (!proxy) {
    return fetch(url, { ...init, cache: "no-store" });
  }

  const pUrl = new URL(proxy);
  pUrl.searchParams.set("url", url);

  const headers = new Headers(init?.headers || {});
  const proxyToken = process.env.PROXY_TOKEN?.trim();
  if (proxyToken) headers.set("X-Proxy-Token", proxyToken);

  return fetch(pUrl.toString(), {
    method: init?.method || "GET",
    headers,
    cache: "no-store",
  });
}

async function binanceServerTime(testnet: boolean): Promise<number> {
  const base = getBinanceBaseUrl(testnet);
  const url = `${base}/api/v3/time`;

  const r = await fetchViaOptionalProxy(url, { method: "GET" });
  const text = await r.text();

  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance time error: ${r.status}`);
  }

  const t = Number(json?.serverTime);
  if (!Number.isFinite(t)) throw new Error("Binance serverTime missing");
  return t;
}

async function binanceSpotAccount(apiKey: string, apiSecret: string, testnet: boolean) {
  const base = getBinanceBaseUrl(testnet);
  const recvWindow = 10_000;

  const serverTime = await binanceServerTime(testnet);

  const qs = new URLSearchParams({
    timestamp: String(serverTime),
    recvWindow: String(recvWindow),
  }).toString();

  const signature = sign(qs, apiSecret);
  const url = `${base}/api/v3/account?${qs}&signature=${signature}`;

  const r = await fetchViaOptionalProxy(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    const msg = json?.msg || text || `Binance error: ${r.status}`;
    const code = json?.code;
    const err = new Error(msg);
    (err as AnyJson).binanceCode = code;
    throw err;
  }

  return json;
}

function bybitSignature(params: {
  timestamp: string;
  apiKey: string;
  recvWindow: string;
  payload: string;
  secret: string;
}) {
  const preSign = `${params.timestamp}${params.apiKey}${params.recvWindow}${params.payload}`;
  return crypto.createHmac("sha256", params.secret).update(preSign).digest("hex");
}

async function bybitWalletBalance(
  apiKey: string,
  apiSecret: string,
  isDemo: boolean
) {
  const base = isDemo ? "https://api-demo.bybit.com" : "https://api.bybit.com";
  const timestamp = String(Date.now());
  const recvWindow = "10000";
  const payload = "accountType=UNIFIED";

  const signature = bybitSignature({
    timestamp,
    apiKey,
    recvWindow,
    payload,
    secret: apiSecret,
  });

  const r = await fetch(`${base}/v5/account/wallet-balance?${payload}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": signature,
    },
  });

  const text = await r.text();

  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok || json?.retCode !== 0) {
    const msg = json?.retMsg || text || `Bybit error: ${r.status}`;
    const code = json?.retCode;
    const err = new Error(msg);
    (err as AnyJson).bybitCode = code;
    throw err;
  }

  return json;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = (url.searchParams.get("keyId") || "").trim();
    const testnetRaw = (url.searchParams.get("testnet") || "").trim();
    const testnet = testnetRaw === "1" || testnetRaw === "true";

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

    if (!key.apiKey) return fail(500, "SERVER_ERROR", "apiKey is empty in DB");
    if (!key.secretEnc) return fail(500, "SERVER_ERROR", "secretEnc is empty in DB");

    const apiSecret = decryptString(key.secretEnc);

    if (key.exchange === "BINANCE") {
      const account = await binanceSpotAccount(key.apiKey, apiSecret, testnet);

      const balances = Array.isArray(account?.balances) ? account.balances : [];
      const nonZero = balances
        .map((b: AnyJson) => ({
          asset: String(b?.asset ?? ""),
          free: String(b?.free ?? "0"),
          locked: String(b?.locked ?? "0"),
        }))
        .filter((b: AnyJson) => {
          const free = Number(b.free || 0);
          const locked = Number(b.locked || 0);
          return free !== 0 || locked !== 0;
        });

      return ok({
        exchange: "BINANCE",
        network: testnet ? "TESTNET" : "MAINNET",
        keyId: key.id,
        label: key.label ?? null,
        balances: nonZero,
        raw: {
          canTrade: account?.canTrade ?? null,
          accountType: account?.accountType ?? null,
          makerCommission: account?.makerCommission ?? null,
          takerCommission: account?.takerCommission ?? null,
        },
      });
    }

    if (key.exchange === "BYBIT") {
      const isDemo = /demo/i.test(key.label || "");
      const wallet = await bybitWalletBalance(key.apiKey, apiSecret, isDemo);

      const accounts = Array.isArray(wallet?.result?.list) ? wallet.result.list : [];
      const firstAccount = accounts[0] ?? null;
      const coins = Array.isArray(firstAccount?.coin) ? firstAccount.coin : [];

      const nonZero = coins
        .map((c: AnyJson) => {
          const walletBalance = String(c?.walletBalance ?? "0");
          const locked = String(c?.locked ?? "0");
          return {
            asset: String(c?.coin ?? ""),
            free: walletBalance,
            locked,
          };
        })
        .filter((b: AnyJson) => {
          const free = Number(b.free || 0);
          const locked = Number(b.locked || 0);
          return free !== 0 || locked !== 0;
        });

      let permissions: AnyJson = null;
      try {
        const p = await getBybitApiPermissions(key.apiKey, apiSecret, isDemo);
        permissions = {
          readOnly: p.readOnly,
          canSpotTrade: p.canSpotTrade,
          hasWithdraw: p.hasWithdraw,
        };
      } catch {}

      return ok({
        exchange: "BYBIT",
        network: isDemo ? "DEMO" : "MAINNET",
        keyId: key.id,
        label: key.label ?? null,
        balances: nonZero,
        permissions,
        raw: {
          accountType: firstAccount?.accountType ?? "UNIFIED",
          totalEquity: firstAccount?.totalEquity ?? null,
          totalWalletBalance: firstAccount?.totalWalletBalance ?? null,
          totalAvailableBalance: firstAccount?.totalAvailableBalance ?? null,
        },
      });
    }

    return fail(400, "UNSUPPORTED_EXCHANGE", "Only BINANCE and BYBIT spot supported now");
  } catch (e: AnyJson) {
    const msg = e?.message ?? String(e);

    if (typeof msg === "string" && msg.toLowerCase().includes("restricted location")) {
      return fail(
        502,
        "BINANCE_GEO_BLOCK",
        msg,
        {
          hint:
            "Binance блокирует запросы из региона вашего хостинга. Решение: перенести запросы в другой регион/хостинг или использовать прокси (BINANCE_PROXY_URL).",
        }
      );
    }

    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      msg,
      e?.binanceCode != null
        ? { binanceCode: e.binanceCode }
        : e?.bybitCode != null
          ? { bybitCode: e.bybitCode }
          : undefined
    );
  }
}