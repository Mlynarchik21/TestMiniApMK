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

type SymbolFilters = {
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
};

function sign(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function floorToStep(value: number, step: number) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.floor(value / step) * step;
}

function decimalsFromStep(step: number) {
  const s = String(step);
  if (!s.includes(".")) return 0;
  return s.split(".")[1].replace(/0+$/, "").length;
}

function formatByStep(value: number, step: number) {
  const d = decimalsFromStep(step);
  return floorToStep(value, step).toFixed(d);
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

async function getSymbolFilters(symbol: string): Promise<SymbolFilters> {
  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `exchangeInfo error: ${r.status}`);
  }

  const sym = Array.isArray(json?.symbols) ? json.symbols[0] : null;
  if (!sym) throw new Error(`symbol ${symbol} not found in exchangeInfo`);

  const filters = Array.isArray(sym?.filters) ? sym.filters : [];

  const priceFilter = filters.find((f: AnyJson) => f?.filterType === "PRICE_FILTER");
  const lotSize = filters.find((f: AnyJson) => f?.filterType === "LOT_SIZE");
  const minNotional =
    filters.find((f: AnyJson) => f?.filterType === "NOTIONAL") ||
    filters.find((f: AnyJson) => f?.filterType === "MIN_NOTIONAL");

  return {
    tickSize: toNum(priceFilter?.tickSize || "0.01"),
    stepSize: toNum(lotSize?.stepSize || "0.000001"),
    minQty: toNum(lotSize?.minQty || "0"),
    minNotional: toNum(minNotional?.minNotional || "0"),
  };
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
    throw new Error(json?.msg || text || `Binance market buy error: ${r.status}`);
  }

  return json;
}

async function placeBinanceLimitOrder(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  newClientOrderId: string;
}) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    symbol: params.symbol,
    side: params.side,
    type: "LIMIT",
    timeInForce: "GTC",
    quantity: params.quantity,
    price: params.price,
    newOrderRespType: "RESULT",
    newClientOrderId: params.newClientOrderId,
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = sign(qs, params.apiSecret);

  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/order?${qs}&signature=${signature}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": params.apiKey,
      },
    }
  );

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance limit ${params.side} error: ${r.status}`);
  }

  return json;
}

async function insertBotOrderRow(args: {
  userId: string;
  botPositionId: string;
  exchange: "BINANCE";
  symbol: string;
  kind: "ENTRY" | "GRID" | "TP";
  side: "BUY" | "SELL";
  status: string;
  price?: string | null;
  qty: string;
  exchangeOrderId?: string | null;
  clientOrderId?: string | null;
  meta?: AnyJson;
  placedAt?: boolean;
  filledAt?: boolean;
}) {
  const rawMeta = JSON.stringify(args.meta ?? {});

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
      ${args.userId},
      ${args.botPositionId},
      ${args.exchange}::"Exchange",
      ${args.symbol},
      ${args.kind},
      ${args.side},
      ${args.status},
      ${args.price ? Prisma.sql`${args.price}::decimal` : Prisma.sql`NULL`},
      ${args.qty}::decimal,
      ${args.exchangeOrderId ?? ""},
      ${args.clientOrderId ?? ""},
      ${rawMeta}::jsonb,
      ${args.placedAt ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`NULL`},
      ${args.filledAt ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`NULL`},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);
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

  const alreadyOpen = await prisma.botPosition.count({
    where: {
      userId: bot.userId,
      exchange: "BINANCE",
      symbol,
      status: "OPEN",
    },
  });

  if (alreadyOpen > 0) {
    return {
      ok: false,
      error: "POSITION_ALREADY_OPEN",
      message: `Open position for ${symbol} already exists`,
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

  const symbolFilters = await getSymbolFilters(symbol);

  const marketOrder = await placeBinanceMarketBuy(
    key.apiKey,
    apiSecret,
    symbol,
    firstOrderUsdt
  );

  const executedQty = toNum(marketOrder?.executedQty);
  const quoteSpent = toNum(marketOrder?.cummulativeQuoteQty);

  if (executedQty <= 0 || quoteSpent <= 0) {
    return {
      ok: false,
      error: "ORDER_NOT_FILLED",
      message: "Market order did not return executed quantity",
      rawOrder: marketOrder,
    };
  }

  const avgPrice = quoteSpent / executedQty;
  const tpPriceNum = avgPrice * 1.05;

  const tpQtyNum = floorToStep(executedQty, symbolFilters.stepSize);
  if (tpQtyNum < symbolFilters.minQty) {
    return {
      ok: false,
      error: "TP_QTY_TOO_SMALL",
      message: "TP quantity is below symbol minQty",
      tpQtyNum,
      minQty: symbolFilters.minQty,
    };
  }

  const tpPrice = formatByStep(tpPriceNum, symbolFilters.tickSize);
  const tpQty = formatByStep(tpQtyNum, symbolFilters.stepSize);

  const position = await prisma.botPosition.create({
    data: {
      user: { connect: { id: bot.userId } },
      exchange: "BINANCE",
      symbol,
      status: "OPEN",
      avgPrice: new Prisma.Decimal(avgPrice.toFixed(18)),
      qty: new Prisma.Decimal(executedQty.toFixed(18)),
      tpPrice: new Prisma.Decimal(Number(tpPrice).toFixed(18)),
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

  await insertBotOrderRow({
    userId: bot.userId,
    botPositionId: position.id,
    exchange: "BINANCE",
    symbol,
    kind: "ENTRY",
    side: "BUY",
    status: "FILLED",
    price: avgPrice.toFixed(18),
    qty: executedQty.toFixed(18),
    exchangeOrderId: String(marketOrder?.orderId ?? ""),
    clientOrderId: String(marketOrder?.clientOrderId ?? ""),
    meta: {
      symbol,
      firstOrderUsdt,
      rawOrder: marketOrder,
    },
    placedAt: true,
    filledAt: true,
  });

  const tpClientId = `tp_${Date.now()}_${symbol}`.slice(0, 36);
  const tpOrder = await placeBinanceLimitOrder({
    apiKey: key.apiKey,
    apiSecret,
    symbol,
    side: "SELL",
    quantity: tpQty,
    price: tpPrice,
    newClientOrderId: tpClientId,
  });

  await insertBotOrderRow({
    userId: bot.userId,
    botPositionId: position.id,
    exchange: "BINANCE",
    symbol,
    kind: "TP",
    side: "SELL",
    status: String(tpOrder?.status ?? "PLACED"),
    price: tpPrice,
    qty: tpQty,
    exchangeOrderId: String(tpOrder?.orderId ?? ""),
    clientOrderId: String(tpOrder?.clientOrderId ?? tpClientId),
    meta: {
      level: "TP",
      sourceAvgPrice: avgPrice,
      tpPercent: 5,
      rawOrder: tpOrder,
    },
    placedAt: true,
    filledAt: false,
  });

  const gridOrders: AnyJson[] = [];

  for (let i = 1; i <= 5; i++) {
    const levelPriceNum = avgPrice * (1 - 0.05 * i);
    const levelPriceRounded = floorToStep(levelPriceNum, symbolFilters.tickSize);
    const levelQtyNum = floorToStep(firstOrderUsdt / levelPriceRounded, symbolFilters.stepSize);

    if (levelQtyNum < symbolFilters.minQty) {
      gridOrders.push({
        level: i,
        skipped: true,
        reason: "qty below minQty",
        levelPrice: levelPriceRounded,
        qty: levelQtyNum,
      });
      continue;
    }

    const notion = levelPriceRounded * levelQtyNum;
    if (symbolFilters.minNotional > 0 && notion < symbolFilters.minNotional) {
      gridOrders.push({
        level: i,
        skipped: true,
        reason: "notional below minNotional",
        levelPrice: levelPriceRounded,
        qty: levelQtyNum,
        notional: notion,
      });
      continue;
    }

    const levelPrice = formatByStep(levelPriceRounded, symbolFilters.tickSize);
    const levelQty = formatByStep(levelQtyNum, symbolFilters.stepSize);
    const gridClientId = `grid_${i}_${Date.now()}_${symbol}`.slice(0, 36);

    const gridOrder = await placeBinanceLimitOrder({
      apiKey: key.apiKey,
      apiSecret,
      symbol,
      side: "BUY",
      quantity: levelQty,
      price: levelPrice,
      newClientOrderId: gridClientId,
    });

    await insertBotOrderRow({
      userId: bot.userId,
      botPositionId: position.id,
      exchange: "BINANCE",
      symbol,
      kind: "GRID",
      side: "BUY",
      status: String(gridOrder?.status ?? "PLACED"),
      price: levelPrice,
      qty: levelQty,
      exchangeOrderId: String(gridOrder?.orderId ?? ""),
      clientOrderId: String(gridOrder?.clientOrderId ?? gridClientId),
      meta: {
        level: i,
        dropPercentFromFirstEntry: i * 5,
        quoteBudget: firstOrderUsdt,
        rawOrder: gridOrder,
      },
      placedAt: true,
      filledAt: false,
    });

    gridOrders.push({
      level: i,
      price: levelPrice,
      qty: levelQty,
      notional: Number(levelPrice) * Number(levelQty),
      orderId: gridOrder?.orderId ?? null,
      clientOrderId: gridOrder?.clientOrderId ?? gridClientId,
      status: gridOrder?.status ?? "PLACED",
    });
  }

  return {
    ok: true,
    message: "test market buy + tp + grid created",
    balances: stable,
    firstOrderUsdt,
    position: {
      ...position,
      avgPrice: position.avgPrice.toString(),
      qty: position.qty.toString(),
      tpPrice: position.tpPrice.toString(),
    },
    entryOrder: {
      symbol: marketOrder?.symbol ?? symbol,
      orderId: marketOrder?.orderId ?? null,
      clientOrderId: marketOrder?.clientOrderId ?? null,
      status: marketOrder?.status ?? null,
      executedQty,
      quoteSpent,
      avgPrice,
    },
    tpOrder: {
      symbol,
      price: tpPrice,
      qty: tpQty,
      orderId: tpOrder?.orderId ?? null,
      clientOrderId: tpOrder?.clientOrderId ?? tpClientId,
      status: tpOrder?.status ?? null,
    },
    gridOrders,
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