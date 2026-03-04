// app/api/balance/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { Exchange } from "@prisma/client";

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

function hmacSha256Hex(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const exchangeStr = String(url.searchParams.get("exchange") || "").toUpperCase().trim();
    const label = url.searchParams.get("label");
    const exchange = exchangeStr as Exchange;

    if (!exchangeStr) return json({ ok: false, error: "BAD_REQUEST", message: "exchange required" }, { status: 400 });

    // пока делаем 100% рабочий BINANCE spot
    if (exchange !== "BINANCE") {
      return json(
        { ok: false, error: "NOT_SUPPORTED", message: "Currently only BINANCE spot balance is implemented" },
        { status: 400 }
      );
    }

    // берём ключ пользователя (если label задан — по label, иначе самый свежий)
    const key = await prisma.userKey.findFirst({
      where: {
        userId: user.id,
        exchange,
        ...(typeof label === "string" ? { label } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,
        label: true,
        exchange: true,
      },
    });

    if (!key) {
      return json({ ok: false, error: "NO_KEY", message: "No API key saved for this exchange" }, { status: 404 });
    }

    const apiKey = key.apiKey;
    const apiSecret = decryptString(key.secretEnc);

    // Binance signed endpoint: GET /api/v3/account
    const timestamp = Date.now();
    const recvWindow = 5000;

    const qs = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
    const signature = hmacSha256Hex(apiSecret, qs);

    const endpoint = `https://api.binance.com/api/v3/account?${qs}&signature=${signature}`;

    const r = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    });

    const text = await r.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // ignore
    }

    if (!r.ok) {
      return json(
        {
          ok: false,
          error: "EXCHANGE_ERROR",
          status: r.status,
          message: data?.msg || text || "Binance error",
        },
        { status: 400 }
      );
    }

    const balancesRaw: any[] = Array.isArray(data?.balances) ? data.balances : [];
    const balances = balancesRaw
      .map((b) => ({
        asset: String(b.asset || ""),
        free: String(b.free || "0"),
        locked: String(b.locked || "0"),
      }))
      .filter((b) => {
        const free = Number(b.free);
        const locked = Number(b.locked);
        return (Number.isFinite(free) && free !== 0) || (Number.isFinite(locked) && locked !== 0);
      });

    return json({
      ok: true,
      exchange: key.exchange,
      label: key.label,
      balances,
      raw: {
        // можно убрать позже, но пока полезно для дебага
        canTrade: data?.canTrade,
        canWithdraw: data?.canWithdraw,
        canDeposit: data?.canDeposit,
        updateTime: data?.updateTime,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
