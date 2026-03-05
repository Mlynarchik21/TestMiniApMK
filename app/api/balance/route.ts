// app/api/balance/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";

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

  // Важно: при проксировании НЕ передавать лишние поля cache/credentials
  return fetch(pUrl.toString(), {
    method: init?.method || "GET",
    headers,
    cache: "no-store",
  });
}

async function binanceServerTime(): Promise<number> {
  const base = "https://api.binance.com";
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

async function binanceSpotAccount(apiKey: string, apiSecret: string) {
  const base = "https://api.binance.com";
  const recvWindow = 10_000;

  // 1) сначала берём serverTime, чтобы не ловить -1021
  const serverTime = await binanceServerTime();

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
    // Binance обычно отдаёт { code, msg }
    const msg = json?.msg || text || `Binance error: ${r.status}`;

    // Очень полезно вернуть code (если есть)
    const code = json?.code;
    const err = new Error(msg);
    (err as AnyJson).binanceCode = code;
    throw err;
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
        apiKey: true,       // plain
        secretEnc: true,    // encrypted secret
        passphraseEnc: true // optional
      },
    });

    if (!key) return fail(404, "NOT_FOUND", "key not found");

    if (key.exchange !== "BINANCE") {
      return fail(400, "UNSUPPORTED_EXCHANGE", "Only BINANCE spot supported now");
    }

    if (!key.apiKey) return fail(500, "SERVER_ERROR", "apiKey is empty in DB");
    if (!key.secretEnc) return fail(500, "SERVER_ERROR", "secretEnc is empty in DB");

    // decrypt secret
    const apiSecret = decryptString(key.secretEnc);

    const account = await binanceSpotAccount(key.apiKey, apiSecret);

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
  } catch (e: AnyJson) {
    const msg = e?.message ?? String(e);

    // Если Binance ругается на гео — отдадим понятный текст
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
      e?.binanceCode != null ? { binanceCode: e.binanceCode } : undefined
    );
  }
}