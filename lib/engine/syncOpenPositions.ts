import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";
import { getExchangeAdapter } from "@/lib/exchanges";
import type { ExchangeAdapter, ExchangeName } from "@/lib/exchanges/types";
import { notifyTradeClosed } from "@/lib/notifications/telegram";

type AnyJson = any;

type RawBotOrder = {
  id: string;
  userId: string;
  botPositionId: string | null;
  exchange: string;
  symbol: string;
  kind: "ENTRY" | "GRID" | "TP";
  side: "BUY" | "SELL";
  status: string;
  price: string | null;
  qty: string;
  exchangeOrderId: string | null;
  clientOrderId: string | null;
  meta: AnyJson;
};

type BybitAssetBalance = {
  coin: string;
  qty: number;
};

type ReconstructedPosition = {
  symbol: string;
  baseCoin: string;
  qty: number;
  avgPrice: number;
  investedQuote: number;
  addsCount: number;
};

type FillLot = {
  qty: number;
  price: number;
  time: number;
};

const BYBIT_BASE =
  process.env.BYBIT_BASE_URL?.trim() || "https://api-demo.bybit.com";

const STABLE_ASSETS = new Set([
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "BUSD",
  "USDP",
]);

const BYBIT_MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;
const MIN_POSITION_NOTIONAL = 5;
const EPS = 1e-12;

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function upper(v: unknown) {
  return String(v || "").toUpperCase();
}

function isFilledStatus(status: string) {
  return upper(status) === "FILLED";
}

function isTerminalStatus(status: string) {
  return ["FILLED", "CANCELED", "REJECTED", "EXPIRED"].includes(upper(status));
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

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  return usp.toString();
}

function signGet(
  apiKey: string,
  apiSecret: string,
  recvWindow: string,
  timestamp: string,
  query: string
) {
  const payload = `${timestamp}${apiKey}${recvWindow}${query}`;
  return crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
}

function isValidPositionSnapshot(snapshot: {
  qty: number;
  avgPrice: number;
  investedQuote: number;
}) {
  if (!Number.isFinite(snapshot.qty) || snapshot.qty <= 0) return false;
  if (!Number.isFinite(snapshot.avgPrice) || snapshot.avgPrice <= 0) return false;
  if (!Number.isFinite(snapshot.investedQuote) || snapshot.investedQuote <= 0) return false;

  const notionalByMarket = snapshot.qty * snapshot.avgPrice;
  if (!Number.isFinite(notionalByMarket) || notionalByMarket < MIN_POSITION_NOTIONAL) {
    return false;
  }

  if (snapshot.investedQuote < MIN_POSITION_NOTIONAL) {
    return false;
  }

  return true;
}

async function bybitPrivateGet<T = AnyJson>(params: {
  apiKey: string;
  apiSecret: string;
  path: string;
  query?: Record<string, string | number | undefined | null>;
}): Promise<T> {
  const recvWindow = "5000";
  const timestamp = String(Date.now());
  const query = buildQuery(params.query || {});
  const sign = signGet(params.apiKey, params.apiSecret, recvWindow, timestamp, query);
  const url = `${BYBIT_BASE}${params.path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": sign,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.retCode !== 0) {
    throw new Error(json?.retMsg || `Bybit GET error: ${res.status}`);
  }

  return json as T;
}

async function fetchBybitSpotBalances(apiKey: string, apiSecret: string) {
  const json: AnyJson = await bybitPrivateGet({
    apiKey,
    apiSecret,
    path: "/v5/account/wallet-balance",
    query: {
      accountType: "UNIFIED",
    },
  });

  const accounts = Array.isArray(json?.result?.list) ? json.result.list : [];
  const first = accounts[0];
  const coins = Array.isArray(first?.coin) ? first.coin : [];

  const balances: BybitAssetBalance[] = [];

  for (const c of coins) {
    const coin = upper(c?.coin);
    const walletBalance = toNum(c?.walletBalance);

    if (!coin) continue;
    if (STABLE_ASSETS.has(coin)) continue;
    if (walletBalance <= 0) continue;

    balances.push({
      coin,
      qty: walletBalance,
    });
  }

  return balances;
}

async function fetchBybitFilledOrdersChunk(
  apiKey: string,
  apiSecret: string,
  startTime: number,
  endTime: number
) {
  let cursor: string | undefined = undefined;
  const rows: AnyJson[] = [];

  for (let page = 0; page < 30; page++) {
    const json: AnyJson = await bybitPrivateGet({
      apiKey,
      apiSecret,
      path: "/v5/order/history",
      query: {
        category: "spot",
        startTime,
        endTime,
        limit: 50,
        cursor,
      },
    });

    const list = Array.isArray(json?.result?.list) ? json.result.list : [];
    rows.push(...list);

    const next = String(json?.result?.nextPageCursor || "").trim();
    if (!next) break;
    cursor = next;
  }

  return rows.filter((row) => isFilledStatus(String(row?.orderStatus || "")));
}

async function fetchBybitFilledOrders(
  apiKey: string,
  apiSecret: string,
  startTime: number,
  endTime: number
) {
  const allRows: AnyJson[] = [];
  let chunkStart = startTime;

  while (chunkStart < endTime) {
    const chunkEnd = Math.min(chunkStart + BYBIT_MAX_RANGE_MS - 1, endTime);

    const chunkRows = await fetchBybitFilledOrdersChunk(
      apiKey,
      apiSecret,
      chunkStart,
      chunkEnd
    );

    allRows.push(...chunkRows);
    chunkStart = chunkEnd + 1;
  }

  const unique = new Map<string, AnyJson>();

  for (const row of allRows) {
    const orderId = String(row?.orderId || "");
    const updatedTime = String(row?.updatedTime || row?.createdTime || "");
    const symbol = upper(row?.symbol);
    const side = upper(row?.side);
    const qty = String(row?.cumExecQty || row?.qty || "");
    const key = [orderId, updatedTime, symbol, side, qty].join("|");
    unique.set(key, row);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const ta = Number(a?.updatedTime || a?.createdTime || 0);
    const tb = Number(b?.updatedTime || b?.createdTime || 0);
    return ta - tb;
  });
}

async function getPositionOrders(positionId: string) {
  const rows = await prisma.$queryRaw<RawBotOrder[]>(Prisma.sql`
    SELECT
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
      "meta"
    FROM "BotOrder"
    WHERE "botPositionId" = ${positionId}
    ORDER BY "createdAt" ASC
  `);

  return rows;
}

async function updateBotOrderStatus(orderId: string, status: string, meta?: AnyJson) {
  const metaJson = meta == null ? null : JSON.stringify(meta);

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "BotOrder"
    SET
      "status" = ${status},
      "meta" = CASE
        WHEN ${metaJson}::text IS NULL THEN "meta"
        ELSE ${metaJson}::jsonb
      END,
      "updatedAt" = CURRENT_TIMESTAMP,
      "filledAt" = CASE
        WHEN ${status} = 'FILLED' THEN CURRENT_TIMESTAMP
        ELSE "filledAt"
      END
    WHERE "id" = ${orderId}
  `);
}

function countFilledGridOrders(orders: RawBotOrder[]) {
  return orders.filter((o) => o.kind === "GRID" && isFilledStatus(o.status)).length;
}

async function syncPositionAddsCount(positionId: string) {
  const freshOrders = await getPositionOrders(positionId);
  const filledGridCount = countFilledGridOrders(freshOrders);

  const updated = await prisma.botPosition.update({
    where: { id: positionId },
    data: {
      addsCount: filledGridCount,
    },
    select: {
      id: true,
      addsCount: true,
    },
  });

  return {
    addsCount: updated.addsCount ?? 0,
    filledGridCount,
  };
}

async function createBotTrade(args: {
  userId: string;
  botPositionId: string;
  exchange: ExchangeName;
  symbol: string;
  entryValue: number;
  exitValue: number;
  qty: number;
  avgEntryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  addsCount: number;
  openedAt: Date;
  closedAt: Date;
}) {
  const existing = await prisma.botTrade.findFirst({
    where: { botPositionId: args.botPositionId },
    select: { id: true },
  });

  if (existing) return;

  await prisma.botTrade.create({
    data: {
      user: { connect: { id: args.userId } },
      botPosition: { connect: { id: args.botPositionId } },
      exchange: args.exchange,
      symbol: args.symbol,
      entryValue: new Prisma.Decimal(args.entryValue.toFixed(18)),
      exitValue: new Prisma.Decimal(args.exitValue.toFixed(18)),
      qty: new Prisma.Decimal(args.qty.toFixed(18)),
      avgEntryPrice: new Prisma.Decimal(args.avgEntryPrice.toFixed(18)),
      exitPrice: new Prisma.Decimal(args.exitPrice.toFixed(18)),
      pnl: new Prisma.Decimal(args.pnl.toFixed(18)),
      pnlPercent: new Prisma.Decimal(args.pnlPercent.toFixed(18)),
      addsCount: args.addsCount,
      openedAt: args.openedAt,
      closedAt: args.closedAt,
    },
  });
}

async function insertCooldown(userId: string, exchange: ExchangeName, symbol: string) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "CooldownSymbol" (
      "id",
      "userId",
      "exchange",
      "symbol",
      "reason",
      "cooldownUntil",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${userId},
      ${exchange}::"Exchange",
      ${symbol},
      'TP_CLOSED',
      CURRENT_TIMESTAMP + interval '12 hours',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "exchange", "symbol")
    DO UPDATE SET
      "reason" = 'TP_CLOSED',
      "cooldownUntil" = CURRENT_TIMESTAMP + interval '12 hours',
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}

async function cancelTrackedOrdersForPosition(args: {
  exchange: ExchangeAdapter;
  apiKey: string;
  apiSecret: string;
  positionId: string;
  symbol: string;
  excludeOrderId?: string;
}) {
  const orders = await getPositionOrders(args.positionId);
  const canceled: AnyJson[] = [];

  for (const ord of orders) {
    if (args.excludeOrderId && ord.id === args.excludeOrderId) continue;
    if (upper(ord.symbol) !== upper(args.symbol)) continue;

    if (isTerminalStatus(ord.status)) continue;
    if (!ord.exchangeOrderId && !ord.clientOrderId) continue;

    try {
      const cancelRes = await args.exchange.cancelOrder({
        apiKey: args.apiKey,
        apiSecret: args.apiSecret,
        symbol: args.symbol,
        exchangeOrderId: ord.exchangeOrderId ?? undefined,
        clientOrderId: ord.clientOrderId ?? undefined,
      });

      await updateBotOrderStatus(ord.id, "CANCELED", {
        ...(ord.meta ?? {}),
        cancelRes,
      });

      canceled.push({
        id: ord.id,
        kind: ord.kind,
        status: "CANCELED",
      });
    } catch (e: any) {
      canceled.push({
        id: ord.id,
        kind: ord.kind,
        status: "CANCEL_ERROR",
        message: String(e?.message || e),
      });
    }
  }

  return canceled;
}

async function closePositionAsTpFilled(args: {
  userId: string;
  exchangeName: ExchangeName;
  apiKey: string;
  apiSecret: string;
  position: {
    id: string;
    symbol: string;
    avgPrice: any;
    qty: any;
    tpPrice: any;
    addsCount: number;
    investedQuote: any;
    openedAt: Date;
  };
  tpOrder: {
    row: RawBotOrder;
    live: AnyJson;
  };
}) {
  const exchange = getExchangeAdapter(args.exchangeName);

  const live = args.tpOrder.live ?? {};
  const closeTime = new Date();

  const finalQty = toNum(live.executedQty || args.position.qty);
  const finalExitValue =
    toNum(live.cumQuote) || finalQty * toNum(args.position.tpPrice);
  const exitPrice =
    finalQty > 0 ? finalExitValue / finalQty : toNum(args.position.tpPrice);

  const entryValue = toNum(args.position.investedQuote);
  const avgEntryPrice = toNum(args.position.avgPrice);
  const pnl = finalExitValue - entryValue;
  const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

  const canceledOrders = await cancelTrackedOrdersForPosition({
    exchange,
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    positionId: args.position.id,
    symbol: args.position.symbol,
    excludeOrderId: args.tpOrder.row.id,
  });

  const syncedAdds = await syncPositionAddsCount(args.position.id);

  await createBotTrade({
    userId: args.userId,
    botPositionId: args.position.id,
    exchange: args.exchangeName,
    symbol: args.position.symbol,
    entryValue,
    exitValue: finalExitValue,
    qty: finalQty,
    avgEntryPrice,
    exitPrice,
    pnl,
    pnlPercent,
    addsCount: syncedAdds.addsCount,
    openedAt: args.position.openedAt,
    closedAt: closeTime,
  });

  await prisma.botPosition.update({
    where: { id: args.position.id },
    data: {
      status: "CLOSED",
      closedAt: closeTime,
      addsCount: syncedAdds.addsCount,
    },
  });

  await insertCooldown(args.userId, args.exchangeName, args.position.symbol);

  try {
    await notifyTradeClosed({
      userId: args.userId,
      symbol: args.position.symbol,
      positionId: args.position.id,
      avgEntryPrice,
      exitPrice,
      qty: finalQty,
      entryValue,
      exitValue: finalExitValue,
      pnl,
    });
  } catch {}

  return {
    positionId: args.position.id,
    symbol: args.position.symbol,
    action: "CLOSED_BY_FILLED_TP",
    trade: {
      entryValue,
      exitValue: finalExitValue,
      qty: finalQty,
      avgEntryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      addsCount: syncedAdds.addsCount,
    },
    canceledOrders,
  };
}

async function finalizeClosedPosition(args: {
  userId: string;
  exchangeName: ExchangeName;
  apiKey: string;
  apiSecret: string;
  position: {
    id: string;
    symbol: string;
    avgPrice: any;
    qty: any;
    tpPrice: any;
    addsCount: number;
    investedQuote: any;
    openedAt: Date;
    status: string;
  };
  closeReason:
    | "TP_FILLED"
    | "NOT_FOUND_ON_EXCHANGE"
    | "INVALID_OR_DUST"
    | "STEP_ROUNDING_DUST";
}) {
  const exchange = getExchangeAdapter(args.exchangeName);
  const symbol = upper(args.position.symbol);
  const orders = await getPositionOrders(args.position.id);

  for (const ord of orders) {
    if (isTerminalStatus(ord.status)) continue;
    if (!ord.exchangeOrderId && !ord.clientOrderId) continue;

    try {
      await exchange.cancelOrder({
        apiKey: args.apiKey,
        apiSecret: args.apiSecret,
        symbol,
        exchangeOrderId: ord.exchangeOrderId ?? undefined,
        clientOrderId: ord.clientOrderId ?? undefined,
      });
    } catch {}
  }

  const refreshedOrders: Array<{
    row: RawBotOrder;
    liveStatus: string;
    live: AnyJson;
  }> = [];

  for (const ord of orders) {
    let liveStatus = ord.status;
    let liveRaw: AnyJson = null;

    if (ord.exchangeOrderId || ord.clientOrderId) {
      try {
        const live = await exchange.getOrderStatus({
          apiKey: args.apiKey,
          apiSecret: args.apiSecret,
          symbol,
          exchangeOrderId: ord.exchangeOrderId ?? undefined,
          clientOrderId: ord.clientOrderId ?? undefined,
        });

        liveStatus = String(live.status || ord.status);
        liveRaw = live.raw;
      } catch {}
    }

    if (!isTerminalStatus(liveStatus)) {
      liveStatus = ord.kind === "TP" ? "FILLED" : "CANCELED";
    }

    await updateBotOrderStatus(ord.id, liveStatus, {
      ...(ord.meta ?? {}),
      finalizedBySync: true,
      closeReason: args.closeReason,
      live: liveRaw,
    });

    refreshedOrders.push({
      row: ord,
      liveStatus,
      live: liveRaw,
    });
  }

  const syncedAdds = await syncPositionAddsCount(args.position.id);

  const finalQty = toNum(args.position.qty);
  const avgEntryPrice = toNum(args.position.avgPrice);
  const entryValue = toNum(args.position.investedQuote);

  const tpOrder = refreshedOrders.find(
    (x) => x.row.kind === "TP" && x.liveStatus === "FILLED"
  );

  const exitPrice = tpOrder?.row?.price ? toNum(tpOrder.row.price) : toNum(args.position.tpPrice || args.position.avgPrice);
  const exitValue = finalQty > 0 ? finalQty * exitPrice : entryValue;
  const pnl = exitValue - entryValue;
  const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;
  const closeTime = new Date();

  await createBotTrade({
    userId: args.userId,
    botPositionId: args.position.id,
    exchange: args.exchangeName,
    symbol,
    entryValue,
    exitValue,
    qty: finalQty,
    avgEntryPrice,
    exitPrice,
    pnl,
    pnlPercent,
    addsCount: syncedAdds.addsCount,
    openedAt: args.position.openedAt,
    closedAt: closeTime,
  });

  await prisma.botPosition.update({
    where: { id: args.position.id },
    data: {
      status: "CLOSED",
      closedAt: closeTime,
      addsCount: syncedAdds.addsCount,
    },
  });

  await insertCooldown(args.userId, args.exchangeName, symbol);

  try {
    await notifyTradeClosed({
      userId: args.userId,
      symbol,
      positionId: args.position.id,
      avgEntryPrice,
      exitPrice,
      qty: finalQty,
      entryValue,
      exitValue,
      pnl,
    });
  } catch {}

  return {
    positionId: args.position.id,
    symbol,
    action: `FINALIZED_${args.closeReason}`,
    trade: {
      entryValue,
      exitValue,
      qty: finalQty,
      avgEntryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      addsCount: syncedAdds.addsCount,
    },
  };
}

function reconstructPositionsFromExchange(args: {
  balances: BybitAssetBalance[];
  filledOrders: AnyJson[];
}) {
  const reconstructed: ReconstructedPosition[] = [];

  for (const balance of args.balances) {
    const symbol = `${balance.coin}USDT`;
    const rows = args.filledOrders
      .filter((row) => upper(row?.symbol) === symbol)
      .sort((a, b) => {
        const ta = Number(a?.updatedTime || a?.createdTime || 0);
        const tb = Number(b?.updatedTime || b?.createdTime || 0);
        return ta - tb;
      });

    const lots: FillLot[] = [];

    for (const row of rows) {
      const side = upper(row?.side);
      const qty = toNum(row?.cumExecQty);
      const quote = toNum(row?.cumExecValue);
      const price =
        toNum(row?.avgPrice) || (qty > 0 ? quote / qty : 0);
      const time = Number(row?.updatedTime || row?.createdTime || 0);

      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (!Number.isFinite(price) || price <= 0) continue;

      if (side === "BUY") {
        lots.push({
          qty,
          price,
          time,
        });
        continue;
      }

      if (side === "SELL") {
        let remainingSellQty = qty;

        while (remainingSellQty > EPS && lots.length > 0) {
          const lot = lots[0];
          const takeQty = Math.min(remainingSellQty, lot.qty);

          lot.qty -= takeQty;
          remainingSellQty -= takeQty;

          if (lot.qty <= EPS) {
            lots.shift();
          }
        }
      }
    }

    const balanceQty = balance.qty;
    if (!Number.isFinite(balanceQty) || balanceQty <= EPS) continue;
    if (!lots.length) continue;

    let remainingBalanceToMatch = balanceQty;
    let matchedQty = 0;
    let matchedCost = 0;
    let matchedBuyCount = 0;

    for (let i = lots.length - 1; i >= 0 && remainingBalanceToMatch > EPS; i--) {
      const lot = lots[i];
      if (lot.qty <= EPS) continue;

      const takeQty = Math.min(remainingBalanceToMatch, lot.qty);
      if (takeQty <= EPS) continue;

      matchedQty += takeQty;
      matchedCost += takeQty * lot.price;
      matchedBuyCount += 1;
      remainingBalanceToMatch -= takeQty;
    }

    if (matchedQty <= EPS || matchedCost <= 0) continue;

    const qty = matchedQty;
    const investedQuote = matchedCost;
    const avgPrice = investedQuote / qty;
    const addsCount = Math.max(0, matchedBuyCount - 1);

    const snapshot: ReconstructedPosition = {
      symbol,
      baseCoin: balance.coin,
      qty,
      avgPrice,
      investedQuote,
      addsCount,
    };

    if (!isValidPositionSnapshot(snapshot)) {
      continue;
    }

    reconstructed.push(snapshot);
  }

  return reconstructed.filter((p) => isValidPositionSnapshot(p));
}

async function ensureExistingPositionMatchesExchange(args: {
  userId: string;
  exchangeName: ExchangeName;
  apiKey: string;
  apiSecret: string;
  position: {
    id: string;
    symbol: string;
    avgPrice: any;
    qty: any;
    tpPrice: any;
    addsCount: number;
    investedQuote: any;
    openedAt: Date;
    status: string;
  };
  exchangeSnapshot: ReconstructedPosition | null;
}) {
  const exchange = getExchangeAdapter(args.exchangeName);
  const symbol = upper(args.position.symbol);
  const filters = await exchange.getSymbolFilters(symbol);
  const orders = await getPositionOrders(args.position.id);

  const liveOrders: Array<{
    row: RawBotOrder;
    live: AnyJson;
  }> = [];

  for (const ord of orders) {
    if (!ord.exchangeOrderId && !ord.clientOrderId) continue;

    if (isTerminalStatus(ord.status)) {
      liveOrders.push({
        row: ord,
        live: { status: ord.status },
      });
      continue;
    }

    try {
      const live = await exchange.getOrderStatus({
        apiKey: args.apiKey,
        apiSecret: args.apiSecret,
        symbol,
        exchangeOrderId: ord.exchangeOrderId ?? undefined,
        clientOrderId: ord.clientOrderId ?? undefined,
      });

      if (live.status && live.status !== ord.status) {
        await updateBotOrderStatus(ord.id, String(live.status), {
          ...(ord.meta ?? {}),
          live: live.raw,
        });
      }

      liveOrders.push({
        row: {
          ...ord,
          status: String(live.status || ord.status),
        },
        live,
      });
    } catch {
      liveOrders.push({
        row: ord,
        live: { status: ord.status },
      });
    }
  }

  const filledTpOrders = liveOrders.filter(
    (x) => x.row.kind === "TP" && isFilledStatus(x.row.status)
  );

  if (filledTpOrders.length > 0) {
    return closePositionAsTpFilled({
      userId: args.userId,
      exchangeName: args.exchangeName,
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      position: args.position,
      tpOrder: filledTpOrders[0],
    });
  }

  if (!args.exchangeSnapshot) {
    return finalizeClosedPosition({
      userId: args.userId,
      exchangeName: args.exchangeName,
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      position: args.position,
      closeReason: "NOT_FOUND_ON_EXCHANGE",
    });
  }

  if (!isValidPositionSnapshot(args.exchangeSnapshot)) {
    return finalizeClosedPosition({
      userId: args.userId,
      exchangeName: args.exchangeName,
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      position: args.position,
      closeReason: "INVALID_OR_DUST",
    });
  }

  const activeTpOrders = liveOrders.filter(
    (x) => x.row.kind === "TP" && !isTerminalStatus(x.row.status)
  );

  const finalQtyNum = floorToStep(args.exchangeSnapshot.qty, filters.stepSize);
  const finalTpPrice = formatByStep(args.exchangeSnapshot.avgPrice * 1.05, filters.tickSize);
  const finalNotional = finalQtyNum * args.exchangeSnapshot.avgPrice;

  if (
    !Number.isFinite(finalQtyNum) ||
    finalQtyNum <= 0 ||
    !Number.isFinite(finalNotional) ||
    finalNotional < MIN_POSITION_NOTIONAL ||
    args.exchangeSnapshot.investedQuote < MIN_POSITION_NOTIONAL
  ) {
    return finalizeClosedPosition({
      userId: args.userId,
      exchangeName: args.exchangeName,
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      position: args.position,
      closeReason: "STEP_ROUNDING_DUST",
    });
  }

  const updated = await prisma.botPosition.update({
    where: { id: args.position.id },
    data: {
      status: "OPEN",
      closedAt: null,
      avgPrice: new Prisma.Decimal(args.exchangeSnapshot.avgPrice.toFixed(18)),
      qty: new Prisma.Decimal(finalQtyNum.toFixed(18)),
      tpPrice: new Prisma.Decimal(Number(finalTpPrice).toFixed(18)),
      investedQuote: new Prisma.Decimal(args.exchangeSnapshot.investedQuote.toFixed(18)),
      addsCount: args.exchangeSnapshot.addsCount,
    },
    select: {
      id: true,
      symbol: true,
      avgPrice: true,
      qty: true,
      tpPrice: true,
      investedQuote: true,
      addsCount: true,
    },
  });

  return {
    positionId: updated.id,
    symbol: updated.symbol,
    action: activeTpOrders.length ? "SYNCED_POSITION" : "SYNCED_POSITION_NO_ACTIVE_TP_IN_DB",
    avgPrice: updated.avgPrice.toString(),
    qty: updated.qty.toString(),
    investedQuote: updated.investedQuote.toString(),
    addsCount: updated.addsCount,
  };
}

async function createImportedPosition(args: {
  userId: string;
  exchangeName: ExchangeName;
  snapshot: ReconstructedPosition;
}) {
  const exchange = getExchangeAdapter(args.exchangeName);
  const filters = await exchange.getSymbolFilters(args.snapshot.symbol);

  if (!isValidPositionSnapshot(args.snapshot)) {
    return {
      positionId: null,
      symbol: args.snapshot.symbol,
      action: "SKIPPED_DUST_OR_INVALID_IMPORT",
    };
  }

  const finalQtyNum = floorToStep(args.snapshot.qty, filters.stepSize);
  const finalTpPrice = formatByStep(args.snapshot.avgPrice * 1.05, filters.tickSize);
  const finalNotional = finalQtyNum * args.snapshot.avgPrice;

  if (
    !Number.isFinite(finalQtyNum) ||
    finalQtyNum <= 0 ||
    !Number.isFinite(finalNotional) ||
    finalNotional < MIN_POSITION_NOTIONAL ||
    args.snapshot.investedQuote < MIN_POSITION_NOTIONAL
  ) {
    return {
      positionId: null,
      symbol: args.snapshot.symbol,
      action: "SKIPPED_DUST_AFTER_STEP_ROUNDING",
    };
  }

  const created = await prisma.botPosition.create({
    data: {
      user: { connect: { id: args.userId } },
      exchange: args.exchangeName,
      symbol: args.snapshot.symbol,
      status: "OPEN",
      avgPrice: new Prisma.Decimal(args.snapshot.avgPrice.toFixed(18)),
      qty: new Prisma.Decimal(finalQtyNum.toFixed(18)),
      tpPrice: new Prisma.Decimal(Number(finalTpPrice).toFixed(18)),
      investedQuote: new Prisma.Decimal(args.snapshot.investedQuote.toFixed(18)),
      addsCount: args.snapshot.addsCount,
    },
    select: {
      id: true,
      symbol: true,
      avgPrice: true,
      qty: true,
      tpPrice: true,
      investedQuote: true,
      addsCount: true,
    },
  });

  return {
    positionId: created.id,
    symbol: created.symbol,
    action: "IMPORTED_FROM_EXCHANGE",
    avgPrice: created.avgPrice.toString(),
    qty: created.qty.toString(),
    investedQuote: created.investedQuote.toString(),
    addsCount: created.addsCount,
  };
}

export async function syncOpenPositionsForUser(userId: string) {
  const config = await prisma.botConfig.findUnique({
    where: { userId },
    select: {
      exchange: true,
      keyId: true,
    },
  });

  if (!config?.keyId) {
    return {
      ok: false,
      message: "No bot config or API key",
      synced: [],
    };
  }

  const key = await prisma.userKey.findFirst({
    where: {
      id: config.keyId,
      userId,
    },
    select: {
      apiKey: true,
      secretEnc: true,
    },
  });

  if (!key) {
    return {
      ok: false,
      message: "User key not found",
      synced: [],
    };
  }

  const exchangeName = config.exchange as ExchangeName;
  const apiSecret = decryptString(key.secretEnc);

  if (exchangeName !== "BYBIT") {
    return {
      ok: false,
      message: "syncOpenPositionsForUser currently supports BYBIT only",
      synced: [],
    };
  }

  const balances = await fetchBybitSpotBalances(key.apiKey, apiSecret);

  const now = Date.now();
  const startTime = now - HISTORY_LOOKBACK_MS;
  const filledOrders = await fetchBybitFilledOrders(
    key.apiKey,
    apiSecret,
    startTime,
    now
  );

  const exchangePositions = reconstructPositionsFromExchange({
    balances,
    filledOrders,
  });

  const exchangeMap = new Map<string, ReconstructedPosition>();
  for (const p of exchangePositions) {
    exchangeMap.set(p.symbol, p);
  }

  const dbPositions = await prisma.botPosition.findMany({
    where: {
      userId,
      exchange: exchangeName,
      status: "OPEN",
    },
    select: {
      id: true,
      symbol: true,
      avgPrice: true,
      qty: true,
      tpPrice: true,
      addsCount: true,
      investedQuote: true,
      openedAt: true,
      status: true,
    },
  });

  const synced: AnyJson[] = [];
  const seenSymbols = new Set<string>();

  for (const position of dbPositions) {
    const symbol = upper(position.symbol);
    const snapshot = exchangeMap.get(symbol) ?? null;

    const result = await ensureExistingPositionMatchesExchange({
      userId,
      exchangeName,
      apiKey: key.apiKey,
      apiSecret,
      position,
      exchangeSnapshot: snapshot,
    });

    synced.push(result);

    if (snapshot) {
      seenSymbols.add(symbol);
    }
  }

  for (const snapshot of exchangePositions) {
    const symbol = upper(snapshot.symbol);
    if (seenSymbols.has(symbol)) continue;

    const imported = await createImportedPosition({
      userId,
      exchangeName,
      snapshot,
    });

    synced.push(imported);
  }

  await prisma.botState.updateMany({
    where: { userId },
    data: {
      lastError: null,
    },
  });

  return {
    ok: true,
    synced,
    exchangeOpenCount: exchangePositions.length,
    dbOpenCountAfter: await prisma.botPosition.count({
      where: {
        userId,
        exchange: exchangeName,
        status: "OPEN",
      },
    }),
  };
}
