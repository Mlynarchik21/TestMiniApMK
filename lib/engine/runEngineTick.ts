import { notifyTradeOpened } from "@/lib/notifications/telegram";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";

const BINANCE_TESTNET_BASE = "https://testnet.binance.vision";
const CMC_LISTINGS_URL =
  "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest";

const STABLE_ASSETS = new Set([
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "BUSD",
  "USDP",
]);

type AnyJson = any;

type CmcCoin = {
  id: number;
  name: string;
  symbol: string;
  cmc_rank: number;
  quote?: {
    USD?: {
      market_cap?: number;
    };
  };
};

type BinanceTicker24h = {
  symbol: string;
  priceChangePercent: string;
};

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

async function binanceTicker24hAll(): Promise<BinanceTicker24h[]> {
  const r = await fetch(`${BINANCE_TESTNET_BASE}/api/v3/ticker/24hr`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance ticker error: ${r.status}`);
  }

  return Array.isArray(json) ? (json as BinanceTicker24h[]) : [];
}

async function cmcTop100(): Promise<CmcCoin[]> {
  const apiKey = process.env.CMC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CMC_API_KEY missing");
  }

  const url = new URL(CMC_LISTINGS_URL);
  url.searchParams.set("start", "1");
  url.searchParams.set("limit", "100");
  url.searchParams.set("convert", "USD");
  url.searchParams.set("sort", "market_cap");
  url.searchParams.set("sort_dir", "desc");

  const r = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-CMC_PRO_API_KEY": apiKey,
      Accept: "application/json",
    },
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.status?.error_message || text || `CMC error: ${r.status}`);
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows as CmcCoin[];
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

async function createCycle(userId: string, exchange: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "EngineCycle" (
      "id",
      "userId",
      "exchange",
      "status",
      "message",
      "startedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${userId},
      ${exchange}::"Exchange",
      'STARTED',
      'Engine tick started',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);

  return rows[0]?.id ?? null;
}

async function finishCycle(
  cycleId: string,
  status: "SUCCESS" | "SKIPPED" | "ERROR",
  message: string,
  meta?: AnyJson
) {
  const metaJson = meta == null ? null : JSON.stringify(meta);

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "EngineCycle"
    SET
      "status" = ${status},
      "message" = ${message},
      "meta" = ${metaJson}::jsonb,
      "finishedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${cycleId}
  `);
}

async function getLastEntryAt(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ createdAt: Date | string }>>(Prisma.sql`
    SELECT "createdAt"
    FROM "BotOrder"
    WHERE "userId" = ${userId}
      AND "kind" = 'ENTRY'
      AND "status" IN ('NEW', 'PLACED', 'FILLED')
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  return rows[0]?.createdAt ? new Date(rows[0].createdAt) : null;
}

function minutesDiff(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 1000 / 60);
}

function pickCandidate(cmcCoins: CmcCoin[], tickers: BinanceTicker24h[]) {
  const tickerMap = new Map<string, BinanceTicker24h>();

  for (const t of tickers) {
    tickerMap.set(String(t.symbol), t);
  }

  const candidates: Array<{
    symbol: string;
    baseSymbol: string;
    marketCap: number;
    rank: number;
    priceChangePercent: number;
    cmcId: number;
    name: string;
  }> = [];

  for (const coin of cmcCoins) {
    const baseSymbol = String(coin.symbol || "").toUpperCase().trim();
    if (!baseSymbol) continue;
    if (STABLE_ASSETS.has(baseSymbol)) continue;

    const pair = `${baseSymbol}USDT`;
    const ticker = tickerMap.get(pair);
    if (!ticker) continue;

    const drop24h = toNum(ticker.priceChangePercent);
    if (drop24h > -10) continue;

    const marketCap = toNum(coin.quote?.USD?.market_cap);

    candidates.push({
      symbol: pair,
      baseSymbol,
      marketCap,
      rank: toNum(coin.cmc_rank),
      priceChangePercent: drop24h,
      cmcId: toNum(coin.id),
      name: String(coin.name || baseSymbol),
    });
  }

  candidates.sort((a, b) => {
    if (b.marketCap !== a.marketCap) return b.marketCap - a.marketCap;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.symbol.localeCompare(b.symbol);
  });

  return {
    candidate: candidates[0] ?? null,
    candidatesCount: candidates.length,
    top5: candidates.slice(0, 5),
  };
}

async function isCooldownActive(userId: string, symbol: string) {
  const row = await prisma.cooldownSymbol.findUnique({
    where: {
      userId_exchange_symbol: {
        userId,
        exchange: "BINANCE",
        symbol,
      },
    },
    select: {
      cooldownUntil: true,
    },
  });

  if (!row?.cooldownUntil) return false;
  return row.cooldownUntil.getTime() > Date.now();
}

async function openPositionForSymbol(args: {
  userId: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  budgetPerSymbol: Prisma.Decimal;
  totalStable: number;
  freeStable: number;
}) {
  const alreadyOpen = await prisma.botPosition.count({
    where: {
      userId: args.userId,
      exchange: "BINANCE",
      symbol: args.symbol,
      status: "OPEN",
    },
  });

  if (alreadyOpen > 0) {
    return {
      ok: false,
      error: "POSITION_ALREADY_OPEN",
      message: `Open position for ${args.symbol} already exists`,
    };
  }

  const cooldown = await isCooldownActive(args.userId, args.symbol);
  if (cooldown) {
    return {
      ok: false,
      error: "COOLDOWN_ACTIVE",
      message: `${args.symbol} is still in cooldown`,
    };
  }

  const symbolFilters = await getSymbolFilters(args.symbol);

  let firstOrderUsdt = toNum(args.budgetPerSymbol);
  if (firstOrderUsdt <= 0) {
    firstOrderUsdt = roundQuoteQty(args.totalStable * 0.015);
  }

  firstOrderUsdt = roundQuoteQty(firstOrderUsdt);

  if (firstOrderUsdt < 5) {
    return {
      ok: false,
      error: "ORDER_TOO_SMALL",
      message: "Calculated first order is too small",
      firstOrderUsdt,
    };
  }

  if (args.freeStable < firstOrderUsdt) {
    return {
      ok: false,
      error: "INSUFFICIENT_FREE_STABLE",
      message: "Not enough free stable balance for first order",
      firstOrderUsdt,
      freeStable: args.freeStable,
    };
  }

  const marketOrder = await placeBinanceMarketBuy(
    args.apiKey,
    args.apiSecret,
    args.symbol,
    firstOrderUsdt
  );

  const executedQty = toNum(marketOrder?.executedQty);

  let quoteSpent = toNum(marketOrder?.cummulativeQuoteQty);
  if (quoteSpent <= 0) {
    const fills = Array.isArray(marketOrder?.fills) ? marketOrder.fills : [];
    quoteSpent = fills.reduce((sum: number, fill: any) => {
      return sum + toNum(fill?.price) * toNum(fill?.qty);
    }, 0);
  }

  if (executedQty <= 0 || quoteSpent <= 0) {
    return {
      ok: false,
      error: "ORDER_NOT_FILLED",
      message: "Market order did not return executed quantity or quote spent",
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
      user: { connect: { id: args.userId } },
      exchange: "BINANCE",
      symbol: args.symbol,
      status: "OPEN",
      avgPrice: new Prisma.Decimal(avgPrice.toFixed(18)),
      qty: new Prisma.Decimal(executedQty.toFixed(18)),
      tpPrice: new Prisma.Decimal(Number(tpPrice).toFixed(18)),
      addsCount: 0,
      investedQuote: new Prisma.Decimal(quoteSpent.toFixed(18)),
    },
    select: {
      id: true,
      symbol: true,
      avgPrice: true,
      qty: true,
      tpPrice: true,
      investedQuote: true,
      addsCount: true,
      openedAt: true,
    },
  });

  await insertBotOrderRow({
    userId: args.userId,
    botPositionId: position.id,
    exchange: "BINANCE",
    symbol: args.symbol,
    kind: "ENTRY",
    side: "BUY",
    status: "FILLED",
    price: avgPrice.toFixed(18),
    qty: executedQty.toFixed(18),
    exchangeOrderId: String(marketOrder?.orderId ?? ""),
    clientOrderId: String(marketOrder?.clientOrderId ?? ""),
    meta: {
      symbol: args.symbol,
      firstOrderUsdt,
      quoteSpent,
      rawOrder: marketOrder,
    },
    placedAt: true,
    filledAt: true,
  });

  const tpClientId = `tp_${Date.now()}_${args.symbol}`.slice(0, 36);
  const tpOrder = await placeBinanceLimitOrder({
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    symbol: args.symbol,
    side: "SELL",
    quantity: tpQty,
    price: tpPrice,
    newClientOrderId: tpClientId,
  });

  await insertBotOrderRow({
    userId: args.userId,
    botPositionId: position.id,
    exchange: "BINANCE",
    symbol: args.symbol,
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

    const notional = levelPriceRounded * levelQtyNum;
    if (symbolFilters.minNotional > 0 && notional < symbolFilters.minNotional) {
      gridOrders.push({
        level: i,
        skipped: true,
        reason: "notional below minNotional",
        levelPrice: levelPriceRounded,
        qty: levelQtyNum,
        notional,
      });
      continue;
    }

    const levelPrice = formatByStep(levelPriceRounded, symbolFilters.tickSize);
    const levelQty = formatByStep(levelQtyNum, symbolFilters.stepSize);
    const gridClientId = `grid_${i}_${Date.now()}_${args.symbol}`.slice(0, 36);

    const gridOrder = await placeBinanceLimitOrder({
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      symbol: args.symbol,
      side: "BUY",
      quantity: levelQty,
      price: levelPrice,
      newClientOrderId: gridClientId,
    });

    await insertBotOrderRow({
      userId: args.userId,
      botPositionId: position.id,
      exchange: "BINANCE",
      symbol: args.symbol,
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
    symbol: args.symbol,
    firstOrderUsdt,
    entryOrder: {
      orderId: marketOrder?.orderId ?? null,
      clientOrderId: marketOrder?.clientOrderId ?? null,
      status: marketOrder?.status ?? null,
      executedQty,
      quoteSpent,
      avgPrice,
    },
    tpOrder: {
      orderId: tpOrder?.orderId ?? null,
      clientOrderId: tpOrder?.clientOrderId ?? tpClientId,
      status: tpOrder?.status ?? null,
      price: tpPrice,
      qty: tpQty,
    },
    gridOrders,
    position: {
      id: position.id,
      symbol: position.symbol,
      avgPrice: position.avgPrice.toString(),
      qty: position.qty.toString(),
      tpPrice: position.tpPrice.toString(),
      investedQuote: position.investedQuote.toString(),
      addsCount: position.addsCount,
      openedAt: position.openedAt,
    },
  };
}

export async function runEngineTick() {
  const bots = await prisma.botConfig.findMany({
    where: {
      enabled: true,
      exchange: "BINANCE",
    },
    select: {
      userId: true,
      exchange: true,
      keyId: true,
      maxActiveSymbols: true,
      budgetPerSymbol: true,
      maxTotalBudget: true,
      syncIntervalMin: true,
    },
  });

  if (!bots.length) {
    return {
      ok: true,
      message: "no enabled bots",
      cycles: [],
    };
  }

  const results: AnyJson[] = [];

  for (const bot of bots) {
    const cycleId = await createCycle(bot.userId, bot.exchange);

    try {
      if (!cycleId) {
        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId: null,
          status: "ERROR",
          message: "cycle not created",
        });
        continue;
      }

      const state = await prisma.botState.findUnique({
        where: { userId: bot.userId },
        select: {
          status: true,
        },
      });

      if (!state || state.status !== "RUNNING") {
        await finishCycle(cycleId, "SKIPPED", "bot is not running", {
          state: state?.status ?? null,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "bot is not running",
        });
        continue;
      }

      if (!bot.keyId) {
        await finishCycle(cycleId, "SKIPPED", "API key not selected", {});

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "API key not selected",
        });
        continue;
      }

      const key = await prisma.userKey.findFirst({
        where: {
          id: bot.keyId,
          userId: bot.userId,
        },
        select: {
          apiKey: true,
          secretEnc: true,
        },
      });

      if (!key) {
        await finishCycle(cycleId, "SKIPPED", "selected API key not found", {
          keyId: bot.keyId,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "selected API key not found",
        });
        continue;
      }

      const activePositions = await prisma.botPosition.count({
        where: {
          userId: bot.userId,
          exchange: "BINANCE",
          status: "OPEN",
        },
      });

      if (activePositions >= bot.maxActiveSymbols) {
        await finishCycle(cycleId, "SKIPPED", "active positions limit reached", {
          activePositions,
          maxActiveSymbols: bot.maxActiveSymbols,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "active positions limit reached",
        });
        continue;
      }

      const lastEntryAt = await getLastEntryAt(bot.userId);
      if (lastEntryAt) {
        const mins = minutesDiff(lastEntryAt, new Date());

        if (mins < 30) {
          await finishCycle(cycleId, "SKIPPED", "global 30m entry cooldown active", {
            lastEntryAt: lastEntryAt.toISOString(),
            minutesSinceLastEntry: mins,
          });

          results.push({
            userId: bot.userId,
            exchange: bot.exchange,
            cycleId,
            status: "SKIPPED",
            message: "global 30m entry cooldown active",
          });
          continue;
        }
      }

      const apiSecret = decryptString(key.secretEnc);
      const account = await binanceSpotTestnetAccount(key.apiKey, apiSecret);
      const stable = calcStableBalances(account);

      if (stable.totalStable <= 0) {
        await finishCycle(cycleId, "SKIPPED", "no stablecoin capital found", stable);

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "no stablecoin capital found",
        });
        continue;
      }

      const minFreeRequired = stable.totalStable * 0.1;
      if (stable.freeStable <= minFreeRequired) {
        await finishCycle(cycleId, "SKIPPED", "free stable balance is at or below 10%", {
          ...stable,
          minFreeRequired,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "free stable balance is at or below 10%",
        });
        continue;
      }

      const cmcCoins = await cmcTop100();
      const tickers = await binanceTicker24hAll();
      const scan = pickCandidate(cmcCoins, tickers);

      if (!scan.candidate) {
        await finishCycle(cycleId, "SKIPPED", "no market candidate found", {
          activePositions,
          totalStable: stable.totalStable,
          freeStable: stable.freeStable,
          candidatesCount: scan.candidatesCount,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "no market candidate found",
          candidatesCount: scan.candidatesCount,
        });
        continue;
      }

      const opened = await openPositionForSymbol({
        userId: bot.userId,
        apiKey: key.apiKey,
        apiSecret,
        symbol: scan.candidate.symbol,
        budgetPerSymbol: bot.budgetPerSymbol,
        totalStable: stable.totalStable,
        freeStable: stable.freeStable,
      });

      if (!opened?.ok) {
        await finishCycle(
          cycleId,
          "SKIPPED",
          opened?.message || "candidate found but open skipped",
          {
            activePositions,
            balances: stable,
            candidate: scan.candidate,
            top5: scan.top5,
            openResult: opened,
          }
        );

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: opened?.message || "candidate found but open skipped",
          candidate: scan.candidate,
          openResult: opened,
        });
        continue;
      }

      await prisma.botState.updateMany({
        where: {
          userId: bot.userId,
        },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      await finishCycle(cycleId, "SUCCESS", "position opened", {
        activePositionsBefore: activePositions,
        totalStable: stable.totalStable,
        freeStable: stable.freeStable,
        lockedStable: stable.lockedStable,
        budgetPerSymbol: bot.budgetPerSymbol.toString(),
        maxTotalBudget: bot.maxTotalBudget?.toString() ?? null,
        syncIntervalMin: bot.syncIntervalMin,
        candidate: scan.candidate,
        top5: scan.top5,
        opened,
      });

      results.push({
        userId: bot.userId,
        exchange: bot.exchange,
        cycleId,
        status: "SUCCESS",
        message: "position opened",
        balances: stable,
        candidate: scan.candidate,
        top5: scan.top5,
        opened,
      });
    } catch (e: any) {
      await prisma.botState.updateMany({
        where: {
          userId: bot.userId,
        },
        data: {
          lastError: String(e?.message || e),
        },
      });

      if (cycleId) {
        await finishCycle(cycleId, "ERROR", String(e?.message || e), {});
      }

      results.push({
        userId: bot.userId,
        exchange: bot.exchange,
        cycleId,
        status: "ERROR",
        message: String(e?.message || e),
      });
    }
  }

  return {
    ok: true,
    cycles: results,
  };
}