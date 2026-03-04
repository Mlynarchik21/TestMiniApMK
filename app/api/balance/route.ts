// app/api/balance/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";

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

async function binanceSpotBalances(apiKey: string, apiSecret: string) {
  const baseUrl = process.env.BINANCE_BASE_URL || "https://api.binance.com";
  const timestamp = Date.now();

  const qs = new URLSearchParams({
    timestamp: String(timestamp),
    recvWindow: "5000",
  });

  const signature = hmacSha256Hex(apiSecret, qs.toString());
  qs.set("signature", signature);

  const url = `${baseUrl}/api/v3/account?${qs.toString()}`;

  const r = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
  });

  const text = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    return {
      ok: false as const,
      status: r.status,
      error: j?.msg || text || "Binance error",
      raw: j ?? text,
    };
  }

  const balancesRaw = Array.isArray(j?.balances) ? j.balances : [];
  const balances = balancesRaw
    .map((b: any) => ({
      asset: String(b.asset),
      free: Number(b.free),
      locked: Number(b.locked),
    }))
    .filter((b) => (Number.isFinite(b.free) && b.free !== 0) || (Number.isFinite(b.locked) && b.locked !== 0));

  return { ok: true as const, balances };
}

async function binancePricesUSDT(assets: string[]) {
  const baseUrl = process.env.BINANCE_BASE_URL || "https://api.binance.com";

  // Берём цены на все пары сразу (проще и надежнее)
  const r = await fetch(`${baseUrl}/api/v3/ticker/price`, { cache: "no-store" });
  const list = (await r.json().catch(() => null)) as any[] | null;

  const map = new Map<string, number>(); // symbol -> price
  if (Array.isArray(list)) {
    for (const it of list) {
      const sym = String(it?.symbol || "");
      const p = Number(it?.price);
      if (sym && Number.isFinite(p)) map.set(sym, p);
    }
  }

  // Для каждого asset пытаемся получить оценку в USDT:
  // 1) assetUSDT
  // 2) assetBUSD (редко) -> игнорируем
  // 3) assetBTC + BTCUSDT
  // 4) assetETH + ETHUSDT
  const btcUsdt = map.get("BTCUSDT") ?? null;
  const ethUsdt = map.get("ETHUSDT") ?? null;

  const assetToUsdt = new Map<string, number>();
  for (const a of assets) {
    if (a === "USDT") {
      assetToUsdt.set(a, 1);
      continue;
    }

    const direct = map.get(`${a}USDT`);
    if (direct) {
      assetToUsdt.set(a, direct);
      continue;
    }

    const viaBtc = map.get(`${a}BTC`);
    if (viaBtc && btcUsdt) {
      assetToUsdt.set(a, viaBtc * btcUsdt);
      continue;
    }

    const viaEth = map.get(`${a}ETH`);
    if (viaEth && ethUsdt) {
      assetToUsdt.set(a, viaEth * ethUsdt);
      continue;
    }
  }

  return assetToUsdt;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = String(url.searchParams.get("keyId") || "").trim();
    if (!keyId) return json({ ok: false, error: "BAD_REQUEST", message: "keyId required" }, { status: 400 });

    const key = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,
      } as any,
    });

    if (!key) return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    if (key.exchange !== "BINANCE") {
      return json({ ok: false, error: "NOT_SUPPORTED_YET", message: `exchange ${key.exchange} not implemented` }, { status: 400 });
    }

    // decrypt with fallback
    const apiKeyRaw = String((key as any).apiKey || "");
    const apiSecretRaw = String((key as any).secretEnc || "");

    let apiKey = apiKeyRaw;
    let apiSecret = apiSecretRaw;

    try { apiKey = decryptString(apiKeyRaw); } catch {}
    try { apiSecret = decryptString(apiSecretRaw); } catch {}

    if (!apiKey || !apiSecret) {
      return json({ ok: false, error: "BAD_KEY", message: "apiKey/apiSecret missing after decrypt" }, { status: 400 });
    }

    const b = await binanceSpotBalances(apiKey, apiSecret);
    if (!b.ok) {
      return json({ ok: false, error: "EXCHANGE_ERROR", exchange: "BINANCE", details: b }, { status: 400 });
    }

    const assets = b.balances.map((x) => x.asset);
    const priceMap = await binancePricesUSDT(assets);

    const rows = b.balances
      .map((x) => {
        const total = x.free + x.locked;
        const px = priceMap.get(x.asset) ?? null;
        const estUsdt = px ? total * px : (x.asset === "USDT" ? total : null);
        return {
          asset: x.asset,
          free: x.free,
          locked: x.locked,
          total,
          priceUSDT: px,
          estUSDT: estUsdt,
        };
      })
      .sort((a, b) => (Number(b.estUSDT ?? 0) - Number(a.estUSDT ?? 0)));

    const totalUSDT = rows.reduce((s, r) => s + (Number(r.estUSDT ?? 0) || 0), 0);

    return json({
      ok: true,
      exchange: "BINANCE",
      keyId: key.id,
      balances: rows,
      totalUSDT,
      note: "Spot balances (est. USDT via public prices).",
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
