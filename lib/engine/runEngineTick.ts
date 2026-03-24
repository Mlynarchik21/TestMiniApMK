import { notifyTradeOpened } from "@/lib/notifications/telegram";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";
import { getExchangeAdapter } from "@/lib/exchanges";
import type { ExchangeName } from "@/lib/exchanges/types";

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

type PublicTicker = {
  symbol: string;
  lastPrice?: string;
  price24hPcnt?: string;
  priceChangePercent?: string;
};

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

async function markBotSynced(userId: string) {
  await prisma.botState.updateMany({
    where: { userId },
    data: {
      lastSyncAt: new Date(),
      lastError: null,
    },
  });
}

async function cmcTop100(): Promise<CmcCoin[]> {
  const apiKey = process.env.CMC_API_KEY?.trim();
  if (!apiKey) throw new Error("CMC_API_KEY missing");

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

  return Array.isArray(json?.data) ? json.data : [];
}

async function bybitTickersSpot(): Promise<PublicTicker[]> {
  const r = await fetch("https://api-demo.bybit.com/v5/market/tickers?category=spot", {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok || json?.retCode !== 0) {
    throw new Error(json?.retMsg || text || `Bybit ticker error: ${r.status}`);
  }

  return Array.isArray(json?.result?.list) ? json.result.list : [];
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

function pickCandidate(cmcCoins: CmcCoin[], tickers: PublicTicker[]) {
  const tickerMap = new Map<string, PublicTicker>();
  for (const t of tickers) tickerMap.set(String(t.symbol), t);

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

    const drop24h = toNum(ticker.price24hPcnt) * 100 || toNum(ticker.priceChangePercent);
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

async function isCooldownActive(userId: string, exchange: ExchangeName, symbol: string) {
  const row = await prisma.cooldownSymbol.findUnique({
    where: {
      userId_exchange_symbol: {
        userId,
        exchange,
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

async function insertBotOrderRow(args: {
  userId: string;
  botPositionId: string;
  exchange: ExchangeName;
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

async function openPositionForSymbol(args: {
  userId: string;
  exchange: ExchangeName;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  budgetPerSymbol: Prisma.Decimal;
  totalStable: number;
  freeStable: number;
}) {
  const exchange = getExchangeAdapter(args.exchange);

  const alreadyOpen = await prisma.botPosition.count({
    where: {
      userId: args.userId,
      exchange: args.exchange,
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

  const cooldown = await isCooldownActive(args.userId, args.exchange, args.symbol);
  if (cooldown) {
    return {
      ok: false,
      error: "COOLDOWN_ACTIVE",
      message: `${args.symbol} is still in cooldown`,
    };
  }

  const filters = await exchange.getSymbolFilters(args.symbol);

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

  const entryClientId = `entry_${Date.now()}_${args.symbol}`.slice(0, 36);
  const marketOrder = await exchange.placeMarketBuy({
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    symbol: args.symbol,
    quoteAmount: firstOrderUsdt,
    clientOrderId: entryClientId,
  });

  const executedQty = marketOrder.executedQty;
  const quoteSpent = marketOrder.quoteSpent;

  if (executedQty <= 0 || quoteSpent <= 0) {
    return {
      ok: false,
      error: "ORDER_NOT_FILLED",
      message: "Market order did not return executed quantity or quote spent",
      rawOrder: marketOrder.raw,
    };
  }

  const avgPrice = marketOrder.avgPrice;
  const tpPriceNum = avgPrice * 1.05;
  const tpQtyNum = floorToStep(executedQty, filters.stepSize);

  if (tpQtyNum < filters.minQty) {
    return {
      ok: false,
      error: "TP_QTY_TOO_SMALL",
      message: "TP quantity is below symbol minQty",
      tpQtyNum,
      minQty: filters.minQty,
    };
  }

  const tpPrice = formatByStep(tpPriceNum, filters.tickSize);
  const tpQty = formatByStep(tpQtyNum, filters.stepSize);

  const position = await prisma.botPosition.create({
    data: {
      user: { connect: { id: args.userId } },
      exchange: args.exchange,
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
    exchange: args.exchange,
    symbol: args.symbol,
    kind: "ENTRY",
    side: "BUY",
    status: "FILLED",
    price: avgPrice.toFixed(18),
    qty: executedQty.toFixed(18),
    exchangeOrderId: marketOrder.exchangeOrderId,
    clientOrderId: marketOrder.clientOrderId ?? entryClientId,
    meta: {
      symbol: args.symbol,
      firstOrderUsdt,
      quoteSpent,
      rawOrder: marketOrder.raw,
    },
    placedAt: true,
    filledAt: true,
  });

  const tpClientId = `tp_${Date.now()}_${args.symbol}`.slice(0, 36);
  const tpOrder = await exchange.placeLimitOrder({
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    symbol: args.symbol,
    side: "SELL",
    qty: Number(tpQty),
    price: Number(tpPrice),
    clientOrderId: tpClientId,
  });

  await insertBotOrderRow({
    userId: args.userId,
    botPositionId: position.id,
    exchange: args.exchange,
    symbol: args.symbol,
    kind: "TP",
    side: "SELL",
    status: String(tpOrder.status ?? "PLACED"),
    price: tpPrice,
    qty: tpQty,
    exchangeOrderId: tpOrder.exchangeOrderId,
    clientOrderId: tpOrder.clientOrderId ?? tpClientId,
    meta: {
      level: "TP",
      sourceAvgPrice: avgPrice,
      tpPercent: 5,
      rawOrder: tpOrder.raw,
    },
    placedAt: true,
    filledAt: false,
  });

  const gridOrders: AnyJson[] = [];

  for (let i = 1; i <= 5; i++) {
    const levelPriceNum = avgPrice * (1 - 0.05 * i);
    const levelPriceRounded = floorToStep(levelPriceNum, filters.tickSize);
    const levelQtyNum = floorToStep(firstOrderUsdt / levelPriceRounded, filters.stepSize);

    if (levelQtyNum < filters.minQty) {
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
    if (filters.minNotional > 0 && notional < filters.minNotional) {
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

    const levelPrice = formatByStep(levelPriceRounded, filters.tickSize);
    const levelQty = formatByStep(levelQtyNum, filters.stepSize);
    const gridClientId = `grid_${i}_${Date.now()}_${args.symbol}`.slice(0, 36);

    const gridOrder = await exchange.placeLimitOrder({
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      symbol: args.symbol,
      side: "BUY",
      qty: Number(levelQty),
      price: Number(levelPrice),
      clientOrderId: gridClientId,
    });

    await insertBotOrderRow({
      userId: args.userId,
      botPositionId: position.id,
      exchange: args.exchange,
      symbol: args.symbol,
      kind: "GRID",
      side: "BUY",
      status: String(gridOrder.status ?? "PLACED"),
      price: levelPrice,
      qty: levelQty,
      exchangeOrderId: gridOrder.exchangeOrderId,
      clientOrderId: gridOrder.clientOrderId ?? gridClientId,
      meta: {
        level: i,
        dropPercentFromFirstEntry: i * 5,
        quoteBudget: firstOrderUsdt,
        rawOrder: gridOrder.raw,
      },
      placedAt: true,
      filledAt: false,
    });

    gridOrders.push({
      level: i,
      price: levelPrice,
      qty: levelQty,
      notional: Number(levelPrice) * Number(levelQty),
      orderId: gridOrder.exchangeOrderId,
      clientOrderId: gridOrder.clientOrderId ?? gridClientId,
      status: gridOrder.status ?? "PLACED",
    });
  }

  await notifyTradeOpened({
    userId: args.userId,
    symbol: args.symbol,
    positionId: position.id,
    avgPrice,
    qty: executedQty,
    usdtAmount: quoteSpent,
    tpPrice: Number(tpPrice),
  });

  return {
    ok: true,
    symbol: args.symbol,
    firstOrderUsdt,
    entryOrder: {
      orderId: marketOrder.exchangeOrderId,
      clientOrderId: marketOrder.clientOrderId ?? entryClientId,
      status: marketOrder.status,
      executedQty,
      quoteSpent,
      avgPrice,
    },
    tpOrder: {
      orderId: tpOrder.exchangeOrderId,
      clientOrderId: tpOrder.clientOrderId ?? tpClientId,
      status: tpOrder.status,
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
        select: { status: true, lastSyncAt: true },
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

      if (state.lastSyncAt) {
        const diffMin = minutesDiff(new Date(state.lastSyncAt), new Date());

        if (diffMin < bot.syncIntervalMin) {
          await finishCycle(cycleId, "SKIPPED", "sync interval not reached", {
            lastSyncAt: state.lastSyncAt,
            syncIntervalMin: bot.syncIntervalMin,
            minutesSinceLastSync: diffMin,
          });

          results.push({
            userId: bot.userId,
            exchange: bot.exchange,
            cycleId,
            status: "SKIPPED",
            message: "sync interval not reached",
          });
          continue;
        }
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

      const exchange = getExchangeAdapter(bot.exchange as ExchangeName);
      const activePositions = await prisma.botPosition.count({
        where: {
          userId: bot.userId,
          exchange: bot.exchange,
          status: "OPEN",
        },
      });

      if (activePositions >= bot.maxActiveSymbols) {
        await finishCycle(cycleId, "SKIPPED", "active positions limit reached", {
          activePositions,
          maxActiveSymbols: bot.maxActiveSymbols,
        });

        await markBotSynced(bot.userId);

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

          await markBotSynced(bot.userId);

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
      const stable = await exchange.getBalance(key.apiKey, apiSecret);

      if (stable.totalStable <= 0) {
        await finishCycle(cycleId, "SKIPPED", "no stablecoin capital found", stable);

        await markBotSynced(bot.userId);

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

        await markBotSynced(bot.userId);

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
      const tickers = await bybitTickersSpot();
      const scan = pickCandidate(cmcCoins, tickers);

      if (!scan.candidate) {
        await finishCycle(cycleId, "SKIPPED", "no market candidate found", {
          activePositions,
          totalStable: stable.totalStable,
          freeStable: stable.freeStable,
          candidatesCount: scan.candidatesCount,
        });

        await markBotSynced(bot.userId);

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
        exchange: bot.exchange as ExchangeName,
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

        await markBotSynced(bot.userId);

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

      await markBotSynced(bot.userId);

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
        where: { userId: bot.userId },
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
