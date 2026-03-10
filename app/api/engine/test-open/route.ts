import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

const BINANCE_TESTNET_BASE = "https://testnet.binance.vision";

const STABLE_ASSETS = new Set([
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "BUSD",
  "USDP",
]);

type AnyJson = any;

function sign(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundQuoteQty(n: number) {
  return Math.floor(n * 100) / 100;
}

async function binanceServerTime(): Promise<number> {
  const r = await fetch(`${BINANCE_TESTNET_BASE}/api/v3/time`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance time error: ${r.status}`);
  }

  const t = Number(json?.serverTime);
  if (!Number.isFinite(t)) {
    throw new Error("Binance serverTime missing");
  }

  return t;
}

async function binanceSpotTestnetAccount(apiKey: string, apiSecret: string) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = sign(qs, apiSecret);

  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/account?${qs}&signature=${signature}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    }
  );

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance account error: ${r.status}`);
  }

  return json;
}

function calcStableBalances(account: AnyJson) {
  const balances = Array.isArray(account?.balances) ? account.balances : [];

  let totalStable = 0;
  let freeStable = 0;
  let lockedStable = 0;

  for (const b of balances) {
    const asset = String(b?.asset ?? "");
    if (!STABLE_ASSETS.has(asset)) continue;

    const free = toNum(b?.free);
    const locked = toNum(b?.locked);

    freeStable += free;
    lockedStable += locked;
    totalStable += free + locked;
  }

  return {
    totalStable,
    freeStable,
    lockedStable,
  };
}

async function placeBinanceMarketBuy(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  quoteOrderQty: number
) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    symbol,
    side: "BUY",
    type: "MARKET",
    quoteOrderQty: String(quoteOrderQty),
    newOrderRespType: "FULL",
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = sign(qs, apiSecret);

  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/order?${qs}&signature=${signature}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    }
  );

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance order error: ${r.status}`);
  }

  return json;
}

async function runTestOpen(req: Request) {
  const url = new URL(req.url);
  const symbol = String(url.searchParams.get("symbol") || "BTCUSDT")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{6,20}$/.test(symbol) || !symbol.endsWith("USDT")) {
    return {
      ok: false,
      error: "BAD_REQUEST",
      message: "symbol must look like BTCUSDT and end with USDT",
    };
  }

  const bot = await prisma.botConfig.findFirst({
    where: {
      enabled: true,
      exchange: "BINANCE",
    },
    select: {
      userId: true,
      exchange: true,
      keyId: true,
    },
  });

  if (!bot) {
    return {
      ok: false,
      error: "BOT_NOT_RUNNING",
      message: "No enabled BINANCE bot found",
    };
  }

  if (!bot.keyId) {
    return {
      ok: false,
      error: "API_KEY_NOT_SELECTED",
      message: "Bot config has no selected key",
    };
  }

  const key = await prisma.userKey.findFirst({
    where: {
      id: bot.keyId,
      userId: bot.userId,
    },
    select: {
      id: true,
      apiKey: true,
      secretEnc: true,
    },
  });

  if (!key) {
    return {
      ok: false,
      error: "KEY_NOT_FOUND",
      message: "Selected user key not found",
    };
  }

  const apiSecret = decryptString(key.secretEnc);
  const account = await binanceSpotTestnetAccount(key.apiKey, apiSecret);
  const stable = calcStableBalances(account);

  if (stable.totalStable <= 0) {
    return {
      ok: false,
      error: "NO_STABLE_BALANCE",
      message: "No stablecoin balance found",
      balances: stable,
    };
  }

  const firstOrderUsdtRaw = stable.totalStable * 0.015;
  const firstOrderUsdt = roundQuoteQty(firstOrderUsdtRaw);

  if (firstOrderUsdt < 5) {
    return {
      ok: false,
      error: "ORDER_TOO_SMALL",
      message: "Calculated first order is too small",
      balances: stable,
      firstOrderUsdt,
    };
  }

  if (stable.freeStable < firstOrderUsdt) {
    return {
      ok: false,
      error: "INSUFFICIENT_FREE_STABLE",
      message: "Not enough free stable balance for first order",
      balances: stable,
      firstOrderUsdt,
    };
  }

  const order = await placeBinanceMarketBuy(
    key.apiKey,
    apiSecret,
    symbol,
    firstOrderUsdt
  );

  const executedQty = toNum(order?.executedQty);
  const quoteSpent = toNum(order?.cummulativeQuoteQty);

  if (executedQty <= 0 || quoteSpent <= 0) {
    return {
      ok: false,
      error: "ORDER_NOT_FILLED",
      message: "Market order did not return executed quantity",
      rawOrder: order,
    };
  }

  const avgPrice = quoteSpent / executedQty;
  const tpPrice = avgPrice * 1.05;

  const position = await prisma.botPosition.create({
    data: {
      user: { connect: { id: bot.userId } },
      exchange: "BINANCE",
      symbol,
      status: "OPEN",
      avgPrice: new Prisma.Decimal(avgPrice.toFixed(18)),
      qty: new Prisma.Decimal(executedQty.toFixed(18)),
      tpPrice: new Prisma.Decimal(tpPrice.toFixed(18)),
      addsCount: 0,
    },
    select: {
      id: true,
      userId: true,
      exchange: true,
      symbol: true,
      status: true,
      avgPrice: true,
      qty: true,
      tpPrice: true,
      addsCount: true,
      openedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const rawMeta = JSON.stringify({
    symbol,
    firstOrderUsdt,
    order,
  });

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "BotOrder" (
      "id",
      "userId",
      "botPositionId",
      "exchange",
      "symbol",
      "kind",
      "side",
      "status",
      "price",
      "qty",
      "exchangeOrderId",
      "clientOrderId",
      "meta",
      "placedAt",
      "filledAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${bot.userId},
      ${position.id},
      ${bot.exchange}::"Exchange",
      ${symbol},
      'ENTRY',
      'BUY',
      'FILLED',
      ${avgPrice.toFixed(18)}::decimal,
      ${executedQty.toFixed(18)}::decimal,
      ${String(order?.orderId ?? "")},
      ${String(order?.clientOrderId ?? "")},
      ${rawMeta}::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  return {
    ok: true,
    message: "test market buy created",
    balances: stable,
    firstOrderUsdt,
    position: {
      ...position,
      avgPrice: position.avgPrice.toString(),
      qty: position.qty.toString(),
      tpPrice: position.tpPrice.toString(),
    },
    order: {
      symbol: order?.symbol ?? symbol,
      orderId: order?.orderId ?? null,
      clientOrderId: order?.clientOrderId ?? null,
      status: order?.status ?? null,
      executedQty,
      quoteSpent,
      avgPrice,
    },
  };
}

export async function GET(req: Request) {
  try {
    const data = await runTestOpen(req);
    const status = data.ok ? 200 : 400;
    return NextResponse.json(data, { status });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "TEST_OPEN_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const data = await runTestOpen(req);
    const status = data.ok ? 200 : 400;
    return NextResponse.json(data, { status });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "TEST_OPEN_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}