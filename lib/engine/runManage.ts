import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";

const BINANCE_TESTNET_BASE = "https://testnet.binance.vision";

type AnyJson = any;

type SymbolFilters = {
  tickSize: number;
  stepSize: number;
  minQty: number;
};

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

  if (!r.ok) throw new Error(json?.msg || text || `Binance time error: ${r.status}`);

  const t = Number(json?.serverTime);
  if (!Number.isFinite(t)) throw new Error("Binance serverTime missing");
  return t;
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

  if (!r.ok) throw new Error(json?.msg || text || `exchangeInfo error: ${r.status}`);

  const sym = Array.isArray(json?.symbols) ? json.symbols[0] : null;
  if (!sym) throw new Error(`symbol ${symbol} not found in exchangeInfo`);

  const filters = Array.isArray(sym?.filters) ? sym.filters : [];
  const priceFilter = filters.find((f: AnyJson) => f?.filterType === "PRICE_FILTER");
  const lotSize = filters.find((f: AnyJson) => f?.filterType === "LOT_SIZE");

  return {
    tickSize: toNum(priceFilter?.tickSize || "0.01"),
    stepSize: toNum(lotSize?.stepSize || "0.000001"),
    minQty: toNum(lotSize?.minQty || "0"),
  };
}

async function binanceOrderStatus(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  orderId: string
) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    symbol,
    orderId,
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = sign(qs, apiSecret);

  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/order?${qs}&signature=${signature}`,
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

  if (!r.ok) throw new Error(json?.msg || text || `Binance order status error: ${r.status}`);
  return json;
}

async function binanceCancelOrder(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  orderId: string
) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    symbol,
    orderId,
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = sign(qs, apiSecret);

  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/order?${qs}&signature=${signature}`,
    {
      method: "DELETE",
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

  if (!r.ok) throw new Error(json?.msg || text || `Binance cancel order error: ${r.status}`);
  return json;
}

async function placeBinanceLimitSell(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  quantity: string;
  price: string;
  newClientOrderId: string;
}) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    symbol: params.symbol,
    side: "SELL",
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

  if (!r.ok) throw new Error(json?.msg || text || `Binance limit SELL error: ${r.status}`);
  return json;
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

async function insertTpBotOrder(args: {
  userId: string;
  botPositionId: string;
  symbol: string;
  qty: string;
  price: string;
  exchangeOrderId: string;
  clientOrderId: string;
  rawOrder: AnyJson;
}) {
  const rawMeta = JSON.stringify({
    level: "TP",
    rawOrder: args.rawOrder,
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
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${args.userId},
      ${args.botPositionId},
      'BINANCE'::"Exchange",
      ${args.symbol},
      'TP',
      'SELL',
      'NEW',
      ${args.price}::decimal,
      ${args.qty}::decimal,
      ${args.exchangeOrderId},
      ${args.clientOrderId},
      ${rawMeta}::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);
}

async function insertCooldown(userId: string, symbol: string) {
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
      'BINANCE'::"Exchange",
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

async function createBotTrade(args: {
  userId: string;
  botPositionId: string;
  exchange: "BINANCE";
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
      closeReason: "TP",
      openedAt: args.openedAt,
      closedAt: args.closedAt,
    },
  });
}

async function manageOnePosition(args: {
  userId: string;
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
}) {
  const symbol = args.position.symbol;
  const filters = await getSymbolFilters(symbol);
  const orders = await getPositionOrders(args.position.id);

  const tpOrders = orders.filter(
    (o) => o.kind === "TP" && ["NEW", "PARTIALLY_FILLED", "PLACED"].includes(o.status)
  );
  const gridOrders = orders.filter(
    (o) => o.kind === "GRID" && ["NEW", "PARTIALLY_FILLED", "PLACED"].includes(o.status)
  );

  const tpStatuses: AnyJson[] = [];
  const gridStatuses: AnyJson[] = [];

  for (const tp of tpOrders) {
    if (!tp.exchangeOrderId) continue;

    const live = await binanceOrderStatus(args.apiKey, args.apiSecret, symbol, tp.exchangeOrderId);
    tpStatuses.push(live);

    if (live?.status === "FILLED") {
      await updateBotOrderStatus(tp.id, "FILLED", {
        ...(tp.meta ?? {}),
        live,
      });

      const closeTime = new Date();

      const finalQty = toNum(live.executedQty || args.position.qty);
      const finalExitValue =
        toNum(live.cummulativeQuoteQty) ||
        finalQty * toNum(live.price || args.position.tpPrice);
      const exitPrice =
        finalQty > 0
          ? finalExitValue / finalQty
          : toNum(live.price || args.position.tpPrice);

      const entryValue = toNum(args.position.investedQuote);
      const avgEntryPrice = toNum(args.position.avgPrice);
      const pnl = finalExitValue - entryValue;
      const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

      await createBotTrade({
        userId: args.userId,
        botPositionId: args.position.id,
        exchange: "BINANCE",
        symbol,
        entryValue,
        exitValue: finalExitValue,
        qty: finalQty,
        avgEntryPrice,
        exitPrice,
        pnl,
        pnlPercent,
        addsCount: args.position.addsCount,
        openedAt: args.position.openedAt,
        closedAt: closeTime,
      });

      await prisma.botPosition.update({
        where: { id: args.position.id },
        data: {
          status: "CLOSED",
          closedAt: closeTime,
        },
      });

      const canceledGrid: AnyJson[] = [];
      for (const g of gridOrders) {
        if (!g.exchangeOrderId) continue;

        try {
          const cancelRes = await binanceCancelOrder(
            args.apiKey,
            args.apiSecret,
            symbol,
            g.exchangeOrderId
          );

          await updateBotOrderStatus(g.id, "CANCELED", {
            ...(g.meta ?? {}),
            cancelRes,
          });

          canceledGrid.push({
            id: g.id,
            exchangeOrderId: g.exchangeOrderId,
            status: "CANCELED",
          });
        } catch (e: any) {
          canceledGrid.push({
            id: g.id,
            exchangeOrderId: g.exchangeOrderId,
            status: "CANCEL_ERROR",
            message: String(e?.message || e),
          });
        }
      }

      await insertCooldown(args.userId, symbol);

      return {
        positionId: args.position.id,
        symbol,
        action: "TP_FILLED_POSITION_CLOSED",
        tpOrderId: tp.id,
        trade: {
          entryValue,
          exitValue: finalExitValue,
          qty: finalQty,
          avgEntryPrice,
          exitPrice,
          pnl,
          pnlPercent,
        },
        canceledGrid,
      };
    }

    if (live?.status && live.status !== tp.status) {
      await updateBotOrderStatus(tp.id, String(live.status), {
        ...(tp.meta ?? {}),
        live,
      });
    }
  }

  const newlyFilledGrids: Array<{
    row: RawBotOrder;
    live: AnyJson;
    filledQty: number;
    fillPrice: number;
    quoteSpent: number;
  }> = [];

  for (const g of gridOrders) {
    if (!g.exchangeOrderId) continue;

    const live = await binanceOrderStatus(args.apiKey, args.apiSecret, symbol, g.exchangeOrderId);
    gridStatuses.push(live);

    if (live?.status === "FILLED" && g.status !== "FILLED") {
      const filledQty = toNum(live.executedQty || g.qty);
      const fillPrice = toNum(live.price || g.price);
      const quoteSpent = toNum(live.cummulativeQuoteQty) || filledQty * fillPrice;

      await updateBotOrderStatus(g.id, "FILLED", {
        ...(g.meta ?? {}),
        live,
      });

      newlyFilledGrids.push({
        row: g,
        live,
        filledQty,
        fillPrice,
        quoteSpent,
      });
      continue;
    }

    if (live?.status && live.status !== g.status) {
      await updateBotOrderStatus(g.id, String(live.status), {
        ...(g.meta ?? {}),
        live,
      });
    }
  }

  if (!newlyFilledGrids.length) {
    return {
      positionId: args.position.id,
      symbol,
      action: "NO_CHANGES",
      tpChecked: tpStatuses.length,
      gridChecked: gridStatuses.length,
    };
  }

  const oldQty = toNum(args.position.qty);
  const oldAvgPrice = toNum(args.position.avgPrice);
  const oldCost = oldQty * oldAvgPrice;
  const oldInvestedQuote = toNum(args.position.investedQuote);

  const addedQty = newlyFilledGrids.reduce((s, x) => s + x.filledQty, 0);
  const addedCost = newlyFilledGrids.reduce((s, x) => s + x.quoteSpent, 0);

  const newQty = oldQty + addedQty;
  const newAvgPrice = (oldCost + addedCost) / newQty;
  const newTpPriceNum = newAvgPrice * 1.05;
  const newInvestedQuote = oldInvestedQuote + addedCost;

  const canceledTp: AnyJson[] = [];

  for (const tp of tpOrders) {
    if (!tp.exchangeOrderId) continue;

    try {
      const cancelRes = await binanceCancelOrder(
        args.apiKey,
        args.apiSecret,
        symbol,
        tp.exchangeOrderId
      );

      await updateBotOrderStatus(tp.id, "CANCELED", {
        ...(tp.meta ?? {}),
        cancelRes,
      });

      canceledTp.push({
        id: tp.id,
        exchangeOrderId: tp.exchangeOrderId,
        status: "CANCELED",
      });
    } catch (e: any) {
      canceledTp.push({
        id: tp.id,
        exchangeOrderId: tp.exchangeOrderId,
        status: "CANCEL_ERROR",
        message: String(e?.message || e),
      });
    }
  }

  const finalQtyNum = floorToStep(newQty, filters.stepSize);
  const finalTpPrice = formatByStep(newTpPriceNum, filters.tickSize);
  const finalTpQty = formatByStep(finalQtyNum, filters.stepSize);

  const updatedPosition = await prisma.botPosition.update({
    where: { id: args.position.id },
    data: {
      avgPrice: new Prisma.Decimal(newAvgPrice.toFixed(18)),
      qty: new Prisma.Decimal(finalQtyNum.toFixed(18)),
      tpPrice: new Prisma.Decimal(Number(finalTpPrice).toFixed(18)),
      investedQuote: new Prisma.Decimal(newInvestedQuote.toFixed(18)),
      addsCount: {
        increment: newlyFilledGrids.length,
      },
    },
    select: {
      id: true,
      symbol: true,
      avgPrice: true,
      qty: true,
      tpPrice: true,
      investedQuote: true,
      addsCount: true,
      status: true,
    },
  });

  const tpClientId = `tp_${Date.now()}_${symbol}`.slice(0, 36);
  const newTpOrder = await placeBinanceLimitSell({
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    symbol,
    quantity: finalTpQty,
    price: finalTpPrice,
    newClientOrderId: tpClientId,
  });

  await insertTpBotOrder({
    userId: args.userId,
    botPositionId: args.position.id,
    symbol,
    qty: finalTpQty,
    price: finalTpPrice,
    exchangeOrderId: String(newTpOrder?.orderId ?? ""),
    clientOrderId: String(newTpOrder?.clientOrderId ?? tpClientId),
    rawOrder: newTpOrder,
  });

  return {
    positionId: args.position.id,
    symbol,
    action: "GRID_FILLED_TP_MOVED",
    newlyFilledGridCount: newlyFilledGrids.length,
    newlyFilledGrids: newlyFilledGrids.map((x) => ({
      orderId: x.row.id,
      exchangeOrderId: x.row.exchangeOrderId,
      filledQty: x.filledQty,
      quoteSpent: x.quoteSpent,
    })),
    canceledTp,
    newTpOrder: {
      orderId: newTpOrder?.orderId ?? null,
      clientOrderId: newTpOrder?.clientOrderId ?? tpClientId,
      price: finalTpPrice,
      qty: finalTpQty,
      status: newTpOrder?.status ?? "NEW",
    },
    updatedPosition: {
      ...updatedPosition,
      avgPrice: updatedPosition.avgPrice.toString(),
      qty: updatedPosition.qty.toString(),
      tpPrice: updatedPosition.tpPrice.toString(),
      investedQuote: updatedPosition.investedQuote.toString(),
    },
  };
}

export async function runManage() {
  const bots = await prisma.botConfig.findMany({
    where: {
      enabled: true,
      exchange: "BINANCE",
    },
    select: {
      userId: true,
      keyId: true,
    },
  });

  if (!bots.length) {
    return {
      ok: true,
      message: "no enabled bots",
      managed: [],
    };
  }

  const managed: AnyJson[] = [];

  for (const bot of bots) {
    if (!bot.keyId) {
      managed.push({
        userId: bot.userId,
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
      managed.push({
        userId: bot.userId,
        status: "SKIPPED",
        message: "Selected key not found",
      });
      continue;
    }

    const apiSecret = decryptString(key.secretEnc);

    const positions = await prisma.botPosition.findMany({
      where: {
        userId: bot.userId,
        exchange: "BINANCE",
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
      },
    });

    if (!positions.length) {
      managed.push({
        userId: bot.userId,
        status: "SKIPPED",
        message: "No open positions",
      });
      continue;
    }

    for (const position of positions) {
      try {
        const result = await manageOnePosition({
          userId: bot.userId,
          apiKey: key.apiKey,
          apiSecret,
          position,
        });

        managed.push({
          userId: bot.userId,
          status: "SUCCESS",
          ...result,
        });
      } catch (e: any) {
        managed.push({
          userId: bot.userId,
          positionId: position.id,
          symbol: position.symbol,
          status: "ERROR",
          message: String(e?.message || e),
        });
      }
    }
  }

  return {
    ok: true,
    managed,
  };
}