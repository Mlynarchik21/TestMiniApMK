import {
  notifyTradeAveraged,
  notifyTradeClosed,
} from "@/lib/notifications/telegram";
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

function isActiveBotOrderStatus(status: string) {
  return ["NEW", "PLACED", "PARTIALLY_FILLED"].includes(String(status || "").toUpperCase());
}

function isFilledStatus(status: string) {
  return String(status || "").toUpperCase() === "FILLED";
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
  exchange: ExchangeName;
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
      ${args.exchange}::"Exchange",
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

async function cancelBotOrders(args: {
  exchange: ReturnType<typeof getExchangeAdapter>;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  orders: RawBotOrder[];
}) {
  const canceled: AnyJson[] = [];

  for (const ord of args.orders) {
    if (!isActiveBotOrderStatus(ord.status)) continue;
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
        exchangeOrderId: ord.exchangeOrderId,
        clientOrderId: ord.clientOrderId,
        status: "CANCELED",
      });
    } catch (e: any) {
      canceled.push({
        id: ord.id,
        kind: ord.kind,
        exchangeOrderId: ord.exchangeOrderId,
        clientOrderId: ord.clientOrderId,
        status: "CANCEL_ERROR",
        message: String(e?.message || e),
      });
    }
  }

  return canceled;
}

async function manageOnePosition(args: {
  userId: string;
  exchange: ExchangeName;
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
  const exchange = getExchangeAdapter(args.exchange);
  const symbol = args.position.symbol;
  const filters = await exchange.getSymbolFilters(symbol);
  const orders = await getPositionOrders(args.position.id);

  const tpOrders = orders.filter(
    (o) => o.kind === "TP" && isActiveBotOrderStatus(o.status)
  );
  const gridOrders = orders.filter(
    (o) => o.kind === "GRID" && isActiveBotOrderStatus(o.status)
  );

  const tpStatuses: AnyJson[] = [];
  const gridStatuses: AnyJson[] = [];

  for (const tp of tpOrders) {
    if (!tp.exchangeOrderId && !tp.clientOrderId) continue;

    const live = await exchange.getOrderStatus({
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      symbol,
      exchangeOrderId: tp.exchangeOrderId ?? undefined,
      clientOrderId: tp.clientOrderId ?? undefined,
    });

    tpStatuses.push(live.raw);

    if (isFilledStatus(live.status)) {
      await updateBotOrderStatus(tp.id, "FILLED", {
        ...(tp.meta ?? {}),
        live: live.raw,
      });

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

      const ordersToCancel = orders.filter(
        (o) => o.id !== tp.id && isActiveBotOrderStatus(o.status)
      );

      const canceledOrders = await cancelBotOrders({
        exchange,
        apiKey: args.apiKey,
        apiSecret: args.apiSecret,
        symbol,
        orders: ordersToCancel,
      });

      await createBotTrade({
        userId: args.userId,
        botPositionId: args.position.id,
        exchange: args.exchange,
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

      await insertCooldown(args.userId, args.exchange, symbol);

      await notifyTradeClosed({
        userId: args.userId,
        symbol,
        positionId: args.position.id,
        avgEntryPrice,
        exitPrice,
        qty: finalQty,
        entryValue,
        exitValue: finalExitValue,
        pnl,
      });

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
        canceledOrders,
      };
    }

    if (live.status && live.status !== tp.status) {
      await updateBotOrderStatus(tp.id, String(live.status), {
        ...(tp.meta ?? {}),
        live: live.raw,
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
    if (!g.exchangeOrderId && !g.clientOrderId) continue;

    const live = await exchange.getOrderStatus({
      apiKey: args.apiKey,
      apiSecret: args.apiSecret,
      symbol,
      exchangeOrderId: g.exchangeOrderId ?? undefined,
      clientOrderId: g.clientOrderId ?? undefined,
    });

    gridStatuses.push(live.raw);

    if (isFilledStatus(live.status) && !isFilledStatus(g.status)) {
      const filledQty = toNum(live.executedQty || g.qty);
      const quoteSpent = toNum(live.cumQuote);
      const fillPrice = filledQty > 0 ? quoteSpent / filledQty : toNum(g.price);

      await updateBotOrderStatus(g.id, "FILLED", {
        ...(g.meta ?? {}),
        live: live.raw,
      });

      newlyFilledGrids.push({
        row: g,
        live: live.raw,
        filledQty,
        fillPrice,
        quoteSpent,
      });
      continue;
    }

    if (live.status && live.status !== g.status) {
      await updateBotOrderStatus(g.id, String(live.status), {
        ...(g.meta ?? {}),
        live: live.raw,
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

  const canceledTp = await cancelBotOrders({
    exchange,
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    symbol,
    orders: tpOrders,
  });

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
  const newTpOrder = await exchange.placeLimitOrder({
    apiKey: args.apiKey,
    apiSecret: args.apiSecret,
    symbol,
    side: "SELL",
    qty: Number(finalTpQty),
    price: Number(finalTpPrice),
    clientOrderId: tpClientId,
  });

  await insertTpBotOrder({
    userId: args.userId,
    botPositionId: args.position.id,
    exchange: args.exchange,
    symbol,
    qty: finalTpQty,
    price: finalTpPrice,
    exchangeOrderId: String(newTpOrder.exchangeOrderId ?? ""),
    clientOrderId: String(newTpOrder.clientOrderId ?? tpClientId),
    rawOrder: newTpOrder.raw,
  });

  const lastFilledGrid = newlyFilledGrids[newlyFilledGrids.length - 1];

  await notifyTradeAveraged({
    userId: args.userId,
    symbol,
    positionId: args.position.id,
    orderId: lastFilledGrid?.row?.id ?? args.position.id,
    fillPrice: lastFilledGrid?.fillPrice ?? newAvgPrice,
    newAvgPrice,
    newTpPrice: Number(finalTpPrice),
    totalQty: finalQtyNum,
    totalUsdtAmount: newInvestedQuote,
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
      orderId: newTpOrder.exchangeOrderId ?? null,
      clientOrderId: newTpOrder.clientOrderId ?? tpClientId,
      price: finalTpPrice,
      qty: finalTpQty,
      status: newTpOrder.status ?? "NEW",
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
    },
    select: {
      userId: true,
      exchange: true,
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
        exchange: bot.exchange,
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
        exchange: bot.exchange,
        status: "SKIPPED",
        message: "Selected key not found",
      });
      continue;
    }

    const apiSecret = decryptString(key.secretEnc);

    const positions = await prisma.botPosition.findMany({
      where: {
        userId: bot.userId,
        exchange: bot.exchange,
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
        exchange: bot.exchange,
        status: "SKIPPED",
        message: "No open positions",
      });
      continue;
    }

    for (const position of positions) {
      try {
        const result = await manageOnePosition({
          userId: bot.userId,
          exchange: bot.exchange as ExchangeName,
          apiKey: key.apiKey,
          apiSecret,
          position,
        });

        managed.push({
          userId: bot.userId,
          exchange: bot.exchange,
          status: "SUCCESS",
          ...result,
        });
      } catch (e: any) {
        managed.push({
          userId: bot.userId,
          exchange: bot.exchange,
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