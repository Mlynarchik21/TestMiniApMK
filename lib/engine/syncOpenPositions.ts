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

async function insertTpOrder(args: {
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
  const exchange = getExchangeAdapter(exchangeName);
  const apiSecret = decryptString(key.secretEnc);

  const positions = await prisma.botPosition.findMany({
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

  for (const position of positions) {
    try {
      const symbol = position.symbol;
      const filters = await exchange.getSymbolFilters(symbol);
      const orders = await getPositionOrders(position.id);

      if (!orders.length) {
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
          action: "CLOSED_EMPTY_POSITION_NO_ORDERS",
        });
        continue;
      }

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
            apiKey: key.apiKey,
            apiSecret,
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

      const filledBuyOrders = liveOrders.filter(
        (x) =>
          x.row.side === "BUY" &&
          (x.row.kind === "ENTRY" || x.row.kind === "GRID") &&
          isFilledStatus(x.row.status)
      );

      const activeTpOrders = liveOrders.filter(
        (x) => x.row.kind === "TP" && !isTerminalStatus(x.row.status)
      );

      const filledTpOrders = liveOrders.filter(
        (x) => x.row.kind === "TP" && isFilledStatus(x.row.status)
      );

      if (filledTpOrders.length > 0) {
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
          action: "CLOSED_BY_FILLED_TP",
        });
        continue;
      }

      const totalQty = filledBuyOrders.reduce((sum, x) => {
        const liveQty =
          toNum(x.live?.executedQty) || toNum(x.row.qty);
        return sum + liveQty;
      }, 0);

      const totalCost = filledBuyOrders.reduce((sum, x) => {
        const qty = toNum(x.live?.executedQty) || toNum(x.row.qty);
        const quote =
          toNum(x.live?.cumQuote) ||
          qty * toNum(x.row.price);
        return sum + quote;
      }, 0);

      const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
      const addsCount = filledBuyOrders.filter((x) => x.row.kind === "GRID").length;

      if (totalQty <= 0 || totalCost <= 0 || avgPrice <= 0) {
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
          action: "CLOSED_INVALID_EMPTY_POSITION",
        });
        continue;
      }

      const tpPriceNum = avgPrice * 1.05;
      const finalQtyNum = floorToStep(totalQty, filters.stepSize);
      const finalTpPrice = formatByStep(tpPriceNum, filters.tickSize);
      const finalTpQty = formatByStep(finalQtyNum, filters.stepSize);

      const updated = await prisma.botPosition.update({
        where: { id: position.id },
        data: {
          avgPrice: new Prisma.Decimal(avgPrice.toFixed(18)),
          qty: new Prisma.Decimal(finalQtyNum.toFixed(18)),
          tpPrice: new Prisma.Decimal(Number(finalTpPrice).toFixed(18)),
          investedQuote: new Prisma.Decimal(totalCost.toFixed(18)),
          addsCount,
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

      if (!activeTpOrders.length) {
        const tpClientId = `tp_${Date.now()}_${symbol}`.slice(0, 36);

        const newTpOrder = await exchange.placeLimitOrder({
          apiKey: key.apiKey,
          apiSecret,
          symbol,
          side: "SELL",
          qty: Number(finalTpQty),
          price: Number(finalTpPrice),
          clientOrderId: tpClientId,
        });

        await insertTpOrder({
          userId,
          botPositionId: position.id,
          exchange: exchangeName,
          symbol,
          qty: finalTpQty,
          price: finalTpPrice,
          exchangeOrderId: String(newTpOrder.exchangeOrderId ?? ""),
          clientOrderId: String(newTpOrder.clientOrderId ?? tpClientId),
          rawOrder: newTpOrder.raw,
        });

        synced.push({
          positionId: position.id,
          symbol,
          action: "SYNCED_AND_CREATED_TP",
          avgPrice,
          qty: finalQtyNum,
          investedQuote: totalCost,
          addsCount,
        });
      } else {
        synced.push({
          positionId: position.id,
          symbol,
          action: "SYNCED_POSITION",
          avgPrice,
          qty: finalQtyNum,
          investedQuote: totalCost,
          addsCount,
        });
      }
    } catch (e: any) {
      synced.push({
        positionId: position.id,
        symbol: position.symbol,
        action: "ERROR",
        message: String(e?.message || e),
      });
    }
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
  };
}