// app/api/keys/[id]/balance/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
// важно: нужен decryptString рядом с encryptString
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

function signBinance(query: string, apiSecret: string) {
  return crypto.createHmac("sha256", apiSecret).update(query).digest("hex");
}

async function binanceGetAccount(apiKey: string, apiSecret: string) {
  // SPOT account endpoint
  const baseUrl = process.env.BINANCE_BASE_URL || "https://api.binance.com";
  const timestamp = Date.now();
  const recvWindow = 5000;

  const query = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
  const signature = signBinance(query, apiSecret);

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
      error: j?.msg || "BINANCE_ERROR",
      code: j?.code,
      raw: j,
    };
  }

  // balances: [{asset, free, locked}]
  const balances: Array<{ asset: string; free: string; locked: string }> = j?.balances || [];
  const nonZero = balances.filter((b) => Number(b.free) > 0 || Number(b.locked) > 0);

  // вернем короткий “срез” для проверки
  const pick = (asset: string) =>
    balances.find((b) => b.asset === asset) ?? { asset, free: "0", locked: "0" };

  return {
    ok: true as const,
    canTrade: Boolean(j?.canTrade),
    accountType: j?.accountType,
    // “быстро проверить”: USDT + BTC + любые ненулевые
    sample: {
      USDT: pick("USDT"),
      BTC: pick("BTC"),
    },
    nonZero: nonZero.slice(0, 30),
  };
}

export async function GET(_: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser();

    const id = String(ctx.params?.id || "").trim();
    if (!id) return json({ ok: false, error: "bad_id" }, { status: 400 });

    const keyRow = await prisma.userKey.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        exchange: true,
        label: true,
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,
        createdAt: true,
      },
    });

    if (!keyRow) return json({ ok: false, error: "not_found" }, { status: 404 });

    if (keyRow.exchange !== Exchange.BINANCE) {
      return json({ ok: false, error: "NOT_IMPLEMENTED_FOR_EXCHANGE", exchange: keyRow.exchange }, { status: 400 });
    }

    const apiSecret = decryptString(keyRow.secretEnc);

    const result = await binanceGetAccount(keyRow.apiKey, apiSecret);

    if (!result.ok) {
      return json(
        {
          ok: false,
          error: "EXCHANGE_ERROR",
          exchange: keyRow.exchange,
          details: result,
        },
        { status: 400 }
      );
    }

    return json({
      ok: true,
      exchange: keyRow.exchange,
      key: { id: keyRow.id, label: keyRow.label, createdAt: keyRow.createdAt },
      balance: result,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
