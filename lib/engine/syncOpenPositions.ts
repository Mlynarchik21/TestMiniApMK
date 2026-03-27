import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";
import { getExchangeAdapter } from "@/lib/exchanges";
import type { ExchangeName } from "@/lib/exchanges/types";

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

async function fetchBybitFilledOrders(
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

function reconstructPositionsFromExchange(args: {
  balances: BybitAssetBalance[];
  filledOrders: AnyJson[];
}) {
  const reconstructed: ReconstructedPosition[] = [];

  for (const balance of args.balances) {
    const symbol = `${balance.coin}USDT`;
    const rows = args.filledOrders.filter((row) => upper(row?.symbol) === symbol);

    const buyRows = rows.filter((row) => upper(row?.side) === "BUY");
    const sellRows = rows.filter((row) => upper(row?.side) === "SELL");

    const totalBuyQty = buyRows.reduce((sum, row) => sum + toNum(row?.cumExecQty), 0);
    const totalBuyQuote = buyRows.reduce((sum, row) => sum + toNum(row?.cumExecValue), 0);

    const totalSellQty = sellRows.reduce((sum, row) => sum + toNum(row?.cumExecQty), 0);
    const totalSellQuote = sellRows.reduce((sum, row) => sum + toNum(row?.cumExecValue), 0);

    const qty = balance.qty;
    if (qty <= 0) continue;

    let investedQuote = totalBuyQuote - totalSellQuote;
    if (!Number.isFinite(investedQuote) || investedQuote <= 0) {
      const lastBuy = buyRows[buyRows.length - 1];
      const fallbackAvg =
        toNum(lastBuy?.avgPrice) ||
        (toNum(lastBuy?.cumExecQty) > 0
          ? toNum(lastBuy?.cumExecValue) / toNum(lastBuy?.cumExecQty)
          : 0);

      investedQuote = fallbackAvg > 0 ? fallbackAvg * qty : 0;
    }

    const avgPrice = qty > 0 && investedQuote > 0 ? investedQuote / qty : 0;
    const addsCount = Math.max(0, buyRows.length - 1);

    reconstructed.push({
      symbol,
      baseCoin: balance.coin,
      qty,
      avgPrice,
      investedQuote,
      addsCount,
    });
  }

  return reconstructed.filter(
    (p) =>
      p.qty > 0 &&
      Number.isFinite(p.qty) &&
      p.avgPrice > 0 &&
      Number.isFinite(p.avgPrice) &&
      p.investedQuote > 0 &&
      Number.isFinite(p.investedQuote)
  );
}

async function ensureExistingPositionMatchesExchange(args: {
  userId: string;
  exchangeName: ExchangeName;
  apiKey: string;
  apiSecret: string;
  positionId: string;
  symbol: string;
  exchangeSnapshot: ReconstructedPosition;
}) {
  const exchange = getExchangeAdapter(args.exchangeName);
  const filters = await exchange.getSymbolFilters(args.symbol);
  const orders = await getPositionOrders(args.positionId);

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
        symbol: args.symbol,
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
    await prisma.botPosition.update({
      where: { id: args.positionId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    return {
      positionId: args.positionId,
      symbol: args.symbol,
      action: "CLOSED_BY_FILLED_TP",
    };
  }

  const activeTpOrders = liveOrders.filter(
    (x) => x.row.kind === "TP" && !isTerminalStatus(x.row.status)
  );

  const finalQtyNum = floorToStep(args.exchangeSnapshot.qty, filters.stepSize);
  const finalTpPrice = formatByStep(args.exchangeSnapshot.avgPrice * 1.05, filters.tickSize);

  const updated = await prisma.botPosition.update({
    where: { id: args.positionId },
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

  const finalQtyNum = floorToStep(args.snapshot.qty, filters.stepSize);
  const finalTpPrice = formatByStep(args.snapshot.avgPrice * 1.05, filters.tickSize);

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

  /**
   * Берем историю глубже, чтобы восстановить среднюю цену и addsCount
   * для старых живых позиций.
   */
  const now = Date.now();
  const startTime = now - 180 * 24 * 60 * 60 * 1000;
  const filledOrders = await fetchBybitFilledOrders(key.apiKey, apiSecret, startTime, now);

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
    const snapshot = exchangeMap.get(symbol);

    if (!snapshot) {
      await prisma.botPosition.update({
        where: { id: position.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });

      synced.push({
        positionId: position.id,
        symbol,
        action: "CLOSED_NOT_FOUND_ON_EXCHANGE",
      });
      continue;
    }

    const result = await ensureExistingPositionMatchesExchange({
      userId,
      exchangeName,
      apiKey: key.apiKey,
      apiSecret,
      positionId: position.id,
      symbol,
      exchangeSnapshot: snapshot,
    });

    synced.push(result);
    seenSymbols.add(symbol);
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
      lastSyncAt: new Date(),
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