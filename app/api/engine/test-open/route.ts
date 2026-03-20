import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma, type Exchange } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";
import { notifyTradeOpened } from "@/lib/notifications/telegram";

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

function isBybitDemoLabel(label: string | null | undefined) {
  return /demo/i.test(label || "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bybitSign(params: {
  timestamp: string;
  apiKey: string;
  recvWindow: string;
  payload: string;
  secret: string;
}) {
  const preSign = `${params.timestamp}${params.apiKey}${params.recvWindow}${params.payload}`;
  return crypto.createHmac("sha256", params.secret).update(preSign).digest("hex");
}

async function bybitGet(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  path: string;
  query: string;
}) {
  const timestamp = String(Date.now());
  const recvWindow = "10000";
  const signature = bybitSign({
    timestamp,
    apiKey: params.apiKey,
    recvWindow,
    payload: params.query,
    secret: params.apiSecret,
  });

  const r = await fetch(`${params.base}${params.path}?${params.query}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-BAPI-API-KEY": params.apiKey,
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
    throw new Error(json?.retMsg || text || `Bybit GET error: ${r.status}`);
  }

  return json;
}

async function bybitPost(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  path: string;
  body: AnyJson;
}) {
  const timestamp = String(Date.now());
  const recvWindow = "10000";
  const bodyText = JSON.stringify(params.body);

  const signature = bybitSign({
    timestamp,
    apiKey: params.apiKey,
    recvWindow,
    payload: bodyText,
    secret: params.apiSecret,
  });

  const r = await fetch(`${params.base}${params.path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": signature,
    },
    body: bodyText,
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok || json?.retCode !== 0) {
    throw new Error(json?.retMsg || text || `Bybit POST error: ${r.status}`);
  }

  return json;
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

async function getBinanceSymbolFilters(symbol: string): Promise<SymbolFilters> {
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

async function getBybitSymbolFilters(symbol: string, isDemo: boolean): Promise<SymbolFilters> {
  const base = isDemo ? "https://api-demo.bybit.com" : "https://api.bybit.com";

  const r = await fetch(
    `${base}/v5/market/instruments-info?category=spot&symbol=${encodeURIComponent(symbol)}`,
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

  if (!r.ok || json?.retCode !== 0) {
    throw new Error(json?.retMsg || text || `Bybit instruments error: ${r.status}`);
  }

  const sym = Array.isArray(json?.result?.list) ? json.result.list[0] : null;
  if (!sym) throw new Error(`symbol ${symbol} not found in Bybit instruments`);

  const priceFilter = sym?.priceFilter ?? {};
  const lotSizeFilter = sym?.lotSizeFilter ?? {};

  return {
    tickSize: toNum(priceFilter?.tickSize || "0.01"),
    stepSize: toNum(lotSizeFilter?.basePrecision || lotSizeFilter?.qtyStep || "0.000001"),
    minQty: toNum(lotSizeFilter?.minOrderQty || "0"),
    minNotional: toNum(lotSizeFilter?.minOrderAmt || "0"),
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

async function getBybitStableBalances(apiKey: string, apiSecret: string, isDemo: boolean) {
  const base = isDemo ? "https://api-demo.bybit.com" : "https://api.bybit.com";

  const wallet = await bybitGet({
    base,
    apiKey,
    apiSecret,
    path: "/v5/account/wallet-balance",
    query: "accountType=UNIFIED",
  });

  const accounts = Array.isArray(wallet?.result?.list) ? wallet.result.list : [];
  const firstAccount = accounts[0] ?? null;
  const coins = Array.isArray(firstAccount?.coin) ? firstAccount.coin : [];

  let totalStable = 0;
  let freeStable = 0;
  let lockedStable = 0;

  for (const c of coins) {
    const asset = String(c?.coin ?? "");
    if (!STABLE_ASSETS.has(asset)) continue;

    const walletBalance = toNum(c?.walletBalance);
    const locked = toNum(c?.locked);
    const free = Math.max(walletBalance - locked, 0);

    totalStable += walletBalance;
    freeStable += free;
    lockedStable += locked;
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

async function placeBybitMarketBuy(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  quoteOrderQty: number;
  newClientOrderId: string;
  isDemo: boolean;
}) {
  const base = params.isDemo ? "https://api-demo.bybit.com" : "https://api.bybit.com";

  const created = await bybitPost({
    base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/create",
    body: {
      category: "spot",
      symbol: params.symbol,
      side: "Buy",
      orderType: "Market",
      qty: String(params.quoteOrderQty),
      marketUnit: "quoteCoin",
      orderLinkId: params.newClientOrderId,
    },
  });

  const orderId = String(created?.result?.orderId || "");
  if (!orderId) {
    throw new Error("Bybit market order created without orderId");
  }

  for (let i = 0; i < 8; i++) {
    await sleep(700);

    const live = await bybitGet({
      base,
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      path: "/v5/order/realtime",
      query: `category=spot&symbol=${encodeURIComponent(params.symbol)}&orderId=${encodeURIComponent(orderId)}`,
    });

    const row = Array.isArray(live?.result?.list) ? live.result.list[0] : null;
    if (!row) continue;

    const status = String(row?.orderStatus || "");
    const executedQty = toNum(row?.cumExecQty);
    const quoteSpent = toNum(row?.cumExecValue);
    const avgPrice =
      toNum(row?.avgPrice) || (executedQty > 0 && quoteSpent > 0 ? quoteSpent / executedQty : 0);

    if (status === "Filled" && executedQty > 0 && quoteSpent > 0) {
      return {
        orderId,
        clientOrderId: String(row?.orderLinkId || params.newClientOrderId),
        status,
        executedQty,
        quoteSpent,
        avgPrice,
        rawOrder: row,
      };
    }
  }

  throw new Error("Bybit market order was not filled in time");
}

async function placeBybitLimitOrder(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  newClientOrderId: string;
  isDemo: boolean;
}) {
  const base = params.isDemo ? "https://api-demo.bybit.com" : "https://api.bybit.com";

  const created = await bybitPost({
    base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/create",
    body: {
      category: "spot",
      symbol: params.symbol,
      side: params.side === "BUY" ? "Buy" : "Sell",
      orderType: "Limit",
      qty: params.quantity,
      price: params.price,
      timeInForce: "GTC",
      orderLinkId: params.newClientOrderId,
    },
  });

  return {
    orderId: String(created?.result?.orderId || ""),
    clientOrderId: params.newClientOrderId,
    status: "NEW",
    rawOrder: created,
  };
}

async function insertBotOrderRow(args: {
  userId: string;
  botPositionId: string;
  exchange: Exchange;
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
      message: "No enabled bot found",
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
      exchange: bot.exchange,
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
      label: true,
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
  const isBybitDemo = bot.exchange === "BYBIT" && isBybitDemoLabel(key.label);

  let stable: { totalStable: number; freeStable: number; lockedStable: number };
  let symbolFilters: SymbolFilters;

  if (bot.exchange === "BINANCE") {
    const account = await binanceSpotTestnetAccount(key.apiKey, apiSecret);
    stable = calcStableBalances(account);
    symbolFilters = await getBinanceSymbolFilters(symbol);
  } else if (bot.exchange === "BYBIT") {
    stable = await getBybitStableBalances(key.apiKey, apiSecret, isBybitDemo);
    symbolFilters = await getBybitSymbolFilters(symbol, isBybitDemo);
  } else {
    return {
      ok: false,
      error: "UNSUPPORTED_EXCHANGE",
      message: `Exchange ${bot.exchange} is not supported in test-open`,
    };
  }

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

  let executedQty = 0;
  let quoteSpent = 0;
  let avgPrice = 0;
  let entryExchangeOrderId: string | null = null;
  let entryClientOrderId: string | null = null;
  let entryStatus: string | null = null;
  let entryRawOrder: AnyJson = null;

  if (bot.exchange === "BINANCE") {
    const marketOrder = await placeBinanceMarketBuy(
      key.apiKey,
      apiSecret,
      symbol,
      firstOrderUsdt
    );

    executedQty = toNum(marketOrder?.executedQty);
    quoteSpent = toNum(marketOrder?.cummulativeQuoteQty);

    if (quoteSpent <= 0) {
      const fills = Array.isArray(marketOrder?.fills) ? marketOrder.fills : [];
      quoteSpent = fills.reduce((sum: number, fill: any) => {
        return sum + toNum(fill?.price) * toNum(fill?.qty);
      }, 0);
    }

    entryExchangeOrderId = String(marketOrder?.orderId ?? "");
    entryClientOrderId = String(marketOrder?.clientOrderId ?? "");
    entryStatus = String(marketOrder?.status ?? "");
    entryRawOrder = marketOrder;
  } else {
    const entryClientId = `entry_${Date.now()}_${symbol}`.slice(0, 36);

    const marketOrder = await placeBybitMarketBuy({
      apiKey: key.apiKey,
      apiSecret,
      symbol,
      quoteOrderQty: firstOrderUsdt,
      newClientOrderId: entryClientId,
      isDemo: isBybitDemo,
    });

    executedQty = marketOrder.executedQty;
    quoteSpent = marketOrder.quoteSpent;
    avgPrice = marketOrder.avgPrice;
    entryExchangeOrderId = marketOrder.orderId;
    entryClientOrderId = marketOrder.clientOrderId;
    entryStatus = marketOrder.status;
    entryRawOrder = marketOrder.rawOrder;
  }

  if (executedQty <= 0 || quoteSpent <= 0) {
    return {
      ok: false,
      error: "ORDER_NOT_FILLED",
      message: "Market order did not return executed quantity or quote spent",
      rawOrder: entryRawOrder,
    };
  }

  if (avgPrice <= 0) {
    avgPrice = quoteSpent / executedQty;
  }

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
      exchange: bot.exchange,
      symbol,
      status: "OPEN",
      avgPrice: new Prisma.Decimal(avgPrice.toFixed(18)),
      qty: new Prisma.Decimal(executedQty.toFixed(18)),
      tpPrice: new Prisma.Decimal(Number(tpPrice).toFixed(18)),
      addsCount: 0,
      investedQuote: new Prisma.Decimal(quoteSpent.toFixed(18)),
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
      investedQuote: true,
      openedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await insertBotOrderRow({
    userId: bot.userId,
    botPositionId: position.id,
    exchange: bot.exchange,
    symbol,
    kind: "ENTRY",
    side: "BUY",
    status: "FILLED",
    price: avgPrice.toFixed(18),
    qty: executedQty.toFixed(18),
    exchangeOrderId: entryExchangeOrderId,
    clientOrderId: entryClientOrderId,
    meta: {
      symbol,
      firstOrderUsdt,
      quoteSpent,
      rawOrder: entryRawOrder,
    },
    placedAt: true,
    filledAt: true,
  });

  let tpExchangeOrderId: string | null = null;
  let tpClientOrderId: string | null = null;
  let tpStatus: string | null = null;
  let tpRawOrder: AnyJson = null;

  const tpClientId = `tp_${Date.now()}_${symbol}`.slice(0, 36);

  if (bot.exchange === "BINANCE") {
    const tpOrder = await placeBinanceLimitOrder({
      apiKey: key.apiKey,
      apiSecret,
      symbol,
      side: "SELL",
      quantity: tpQty,
      price: tpPrice,
      newClientOrderId: tpClientId,
    });

    tpExchangeOrderId = String(tpOrder?.orderId ?? "");
    tpClientOrderId = String(tpOrder?.clientOrderId ?? tpClientId);
    tpStatus = String(tpOrder?.status ?? "PLACED");
    tpRawOrder = tpOrder;
  } else {
    const tpOrder = await placeBybitLimitOrder({
      apiKey: key.apiKey,
      apiSecret,
      symbol,
      side: "SELL",
      quantity: tpQty,
      price: tpPrice,
      newClientOrderId: tpClientId,
      isDemo: isBybitDemo,
    });

    tpExchangeOrderId = tpOrder.orderId;
    tpClientOrderId = tpOrder.clientOrderId;
    tpStatus = tpOrder.status;
    tpRawOrder = tpOrder.rawOrder;
  }

  await insertBotOrderRow({
    userId: bot.userId,
    botPositionId: position.id,
    exchange: bot.exchange,
    symbol,
    kind: "TP",
    side: "SELL",
    status: String(tpStatus ?? "PLACED"),
    price: tpPrice,
    qty: tpQty,
    exchangeOrderId: tpExchangeOrderId,
    clientOrderId: tpClientOrderId,
    meta: {
      level: "TP",
      sourceAvgPrice: avgPrice,
      tpPercent: 5,
      rawOrder: tpRawOrder,
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

    let gridExchangeOrderId: string | null = null;
    let gridClientOrderId: string | null = null;
    let gridStatus: string | null = null;
    let gridRawOrder: AnyJson = null;

    if (bot.exchange === "BINANCE") {
      const gridOrder = await placeBinanceLimitOrder({
        apiKey: key.apiKey,
        apiSecret,
        symbol,
        side: "BUY",
        quantity: levelQty,
        price: levelPrice,
        newClientOrderId: gridClientId,
      });

      gridExchangeOrderId = String(gridOrder?.orderId ?? "");
      gridClientOrderId = String(gridOrder?.clientOrderId ?? gridClientId);
      gridStatus = String(gridOrder?.status ?? "PLACED");
      gridRawOrder = gridOrder;
    } else {
      const gridOrder = await placeBybitLimitOrder({
        apiKey: key.apiKey,
        apiSecret,
        symbol,
        side: "BUY",
        quantity: levelQty,
        price: levelPrice,
        newClientOrderId: gridClientId,
        isDemo: isBybitDemo,
      });

      gridExchangeOrderId = gridOrder.orderId;
      gridClientOrderId = gridOrder.clientOrderId;
      gridStatus = gridOrder.status;
      gridRawOrder = gridOrder.rawOrder;
    }

    await insertBotOrderRow({
      userId: bot.userId,
      botPositionId: position.id,
      exchange: bot.exchange,
      symbol,
      kind: "GRID",
      side: "BUY",
      status: String(gridStatus ?? "PLACED"),
      price: levelPrice,
      qty: levelQty,
      exchangeOrderId: gridExchangeOrderId,
      clientOrderId: gridClientOrderId,
      meta: {
        level: i,
        dropPercentFromFirstEntry: i * 5,
        quoteBudget: firstOrderUsdt,
        rawOrder: gridRawOrder,
      },
      placedAt: true,
      filledAt: false,
    });

    gridOrders.push({
      level: i,
      price: levelPrice,
      qty: levelQty,
      notional: Number(levelPrice) * Number(levelQty),
      orderId: gridExchangeOrderId,
      clientOrderId: gridClientOrderId,
      status: gridStatus ?? "PLACED",
    });
  }

  await notifyTradeOpened({
    userId: bot.userId,
    symbol,
    positionId: position.id,
    avgPrice,
    qty: executedQty,
    usdtAmount: quoteSpent,
    tpPrice: Number(tpPrice),
  });

  return {
    ok: true,
    message: "test market buy + tp + grid created",
    exchange: bot.exchange,
    network:
      bot.exchange === "BINANCE"
        ? "TESTNET"
        : isBybitDemo
          ? "DEMO"
          : "MAINNET",
    balances: stable,
    firstOrderUsdt,
    position: {
      ...position,
      avgPrice: position.avgPrice.toString(),
      qty: position.qty.toString(),
      tpPrice: position.tpPrice.toString(),
      investedQuote: position.investedQuote.toString(),
    },
    entryOrder: {
      symbol,
      orderId: entryExchangeOrderId,
      clientOrderId: entryClientOrderId,
      status: entryStatus,
      executedQty,
      quoteSpent,
      avgPrice,
    },
    tpOrder: {
      symbol,
      price: tpPrice,
      qty: tpQty,
      orderId: tpExchangeOrderId,
      clientOrderId: tpClientOrderId,
      status: tpStatus,
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