// app/api/engine/test-close-all/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

type AnyJson = any;

function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function signBinance(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
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

async function binanceServerTime(): Promise<number> {
  const r = await fetch("https://testnet.binance.vision/api/v3/time", {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text();
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(data?.msg || text || `Binance time error: ${r.status}`);
  }

  const t = Number(data?.serverTime);
  if (!Number.isFinite(t)) {
    throw new Error("Binance serverTime missing");
  }

  return t;
}

async function binanceCancelOrder(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  orderId?: string | null;
  clientOrderId?: string | null;
}) {
  const serverTime = await binanceServerTime();

  const usp = new URLSearchParams({
    symbol: params.symbol,
    timestamp: String(serverTime),
    recvWindow: "10000",
  });

  if (params.orderId) usp.set("orderId", String(params.orderId));
  if (params.clientOrderId) usp.set("origClientOrderId", String(params.clientOrderId));

  const qs = usp.toString();
  const signature = signBinance(qs, params.apiSecret);

  const r = await fetch(
    `https://testnet.binance.vision/api/v3/order?${qs}&signature=${signature}`,
    {
      method: "DELETE",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": params.apiKey,
      },
    }
  );

  const text = await r.text();
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(data?.msg || text || `Binance cancel error: ${r.status}`);
  }

  return data;
}

async function binanceMarketSell(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  qty: string;
}) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    symbol: params.symbol,
    side: "SELL",
    type: "MARKET",
    quantity: params.qty,
    newOrderRespType: "FULL",
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = signBinance(qs, params.apiSecret);

  const r = await fetch(
    `https://testnet.binance.vision/api/v3/order?${qs}&signature=${signature}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": params.apiKey,
      },
    }
  );

  const text = await r.text();
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(data?.msg || text || `Binance market sell error: ${r.status}`);
  }

  return data;
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
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok || data?.retCode !== 0) {
    throw new Error(data?.retMsg || text || `Bybit GET error: ${r.status}`);
  }

  return data;
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
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok || data?.retCode !== 0) {
    throw new Error(data?.retMsg || text || `Bybit POST error: ${r.status}`);
  }

  return data;
}

async function bybitGetOrderRealtime(params: {
  apiKey: string;
  apiSecret: string;
  isDemo: boolean;
  symbol: string;
  orderId?: string | null;
  clientOrderId?: string | null;
}) {
  const base = params.isDemo ? "https://api-demo.bybit.com" : "https://api.bybit.com";

  const query = new URLSearchParams({
    category: "spot",
    symbol: params.symbol,
  });

  if (params.orderId) query.set("orderId", params.orderId);
  if (params.clientOrderId) query.set("orderLinkId", params.clientOrderId);

  const live = await bybitGet({
    base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/realtime",
    query: query.toString(),
  });

  const list = Array.isArray(live?.result?.list) ? live.result.list : [];
  return list[0] ?? null;
}

function bybitBaseFromLabel(label: string | null | undefined) {
  return /demo/i.test(label || "") ? "https://api-demo.bybit.com" : "https://api.bybit.com";
}

async function bybitCancelOrder(params: {
  apiKey: string;
  apiSecret: string;
  base: string;
  symbol: string;
  orderId?: string | null;
  clientOrderId?: string | null;
}) {
  return bybitPost({
    base: params.base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/cancel",
    body: {
      category: "spot",
      symbol: params.symbol,
      ...(params.orderId ? { orderId: params.orderId } : {}),
      ...(params.clientOrderId ? { orderLinkId: params.clientOrderId } : {}),
    },
  });
}

async function bybitMarketSell(params: {
  apiKey: string;
  apiSecret: string;
  base: string;
  symbol: string;
  qty: string;
  clientOrderId: string;
}) {
  return bybitPost({
    base: params.base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/create",
    body: {
      category: "spot",
      symbol: params.symbol,
      side: "Sell",
      orderType: "Market",
      qty: params.qty,
      orderLinkId: params.clientOrderId,
      orderFilter: "Order",
    },
  });
}

async function getUserKeyForExchange(userId: string, exchange: "BINANCE" | "BYBIT") {
  const cfg = await prisma.botConfig.findFirst({
    where: { userId, exchange },
    orderBy: { updatedAt: "desc" },
    select: { keyId: true },
  });

  if (cfg?.keyId) {
    const key = await prisma.userKey.findFirst({
      where: { id: cfg.keyId, userId, exchange },
      select: {
        id: true,
        exchange: true,
        label: true,
        apiKey: true,
        secretEnc: true,
      },
    });
    if (key) return key;
  }

  return prisma.userKey.findFirst({
    where: { userId, exchange },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      exchange: true,
      label: true,
      apiKey: true,
      secretEnc: true,
    },
  });
}

async function getOpenOrdersForPosition(positionId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      symbol: string;
      kind: "ENTRY" | "GRID" | "TP";
      side: "BUY" | "SELL";
      status: string;
      exchangeOrderId: string | null;
      clientOrderId: string | null;
    }>
  >(Prisma.sql`
    SELECT
      "id",
      "symbol",
      "kind",
      "side",
      "status",
      "exchangeOrderId",
      "clientOrderId"
    FROM "BotOrder"
    WHERE "botPositionId" = ${positionId}
      AND "status" IN ('NEW', 'PLACED', 'PARTIALLY_FILLED')
    ORDER BY "createdAt" ASC
  `);
}

async function markOrderStatus(orderId: string, status: string, meta?: AnyJson) {
  const metaJson = meta == null ? null : JSON.stringify(meta);

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "BotOrder"
    SET
      "status" = ${status},
      "meta" = CASE
        WHEN ${metaJson}::text IS NULL THEN "meta"
        ELSE ${metaJson}::jsonb
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${orderId}
  `);
}

async function insertCloseOrderRow(args: {
  userId: string;
  botPositionId: string;
  exchange: "BINANCE" | "BYBIT";
  symbol: string;
  qty: string;
  price?: string | null;
  exchangeOrderId?: string | null;
  clientOrderId?: string | null;
  rawOrder?: AnyJson;
}) {
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
      'TP',
      'SELL',
      'FILLED',
      ${args.price ? Prisma.sql`${args.price}::decimal` : Prisma.sql`NULL`},
      ${args.qty}::decimal,
      ${args.exchangeOrderId ?? ""},
      ${args.clientOrderId ?? ""},
      ${JSON.stringify({ manualCloseAll: true, rawOrder: args.rawOrder ?? null })}::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const purge = ["1", "true", "yes"].includes(
      (url.searchParams.get("purge") || "").toLowerCase()
    );

    const positions = await prisma.botPosition.findMany({
      where: {
        userId: user.id,
        status: "OPEN",
        exchange: { in: ["BINANCE", "BYBIT"] },
      },
      orderBy: { openedAt: "asc" },
      select: {
        id: true,
        userId: true,
        exchange: true,
        symbol: true,
        avgPrice: true,
        qty: true,
        investedQuote: true,
        addsCount: true,
        openedAt: true,
      },
    });

    const results: AnyJson[] = [];

    for (const position of positions) {
      try {
        const key = await getUserKeyForExchange(
          user.id,
          position.exchange as "BINANCE" | "BYBIT"
        );

        if (!key) {
          results.push({
            positionId: position.id,
            symbol: position.symbol,
            exchange: position.exchange,
            ok: false,
            error: "KEY_NOT_FOUND",
          });
          continue;
        }

        const apiSecret = decryptString(key.secretEnc);
        const openOrders = await getOpenOrdersForPosition(position.id);

        const canceled: AnyJson[] = [];

        for (const ord of openOrders) {
          try {
            if (position.exchange === "BINANCE") {
              const res = await binanceCancelOrder({
                apiKey: key.apiKey,
                apiSecret,
                symbol: ord.symbol,
                orderId: ord.exchangeOrderId,
                clientOrderId: ord.clientOrderId,
              });

              await markOrderStatus(ord.id, "CANCELED", { cancelRes: res });
            } else {
              const res = await bybitCancelOrder({
                base: bybitBaseFromLabel(key.label),
                apiKey: key.apiKey,
                apiSecret,
                symbol: ord.symbol,
                orderId: ord.exchangeOrderId,
                clientOrderId: ord.clientOrderId,
              });

              await markOrderStatus(ord.id, "CANCELED", { cancelRes: res });
            }

            canceled.push({
              id: ord.id,
              exchangeOrderId: ord.exchangeOrderId,
              clientOrderId: ord.clientOrderId,
              status: "CANCELED",
            });
          } catch (e: any) {
            canceled.push({
              id: ord.id,
              exchangeOrderId: ord.exchangeOrderId,
              clientOrderId: ord.clientOrderId,
              status: "CANCEL_ERROR",
              message: String(e?.message || e),
            });
          }
        }

        const qtyNum = toNum(position.qty);
        if (qtyNum <= 0) {
          await prisma.botPosition.update({
            where: { id: position.id },
            data: {
              status: "CLOSED",
              closedAt: new Date(),
            },
          });

          results.push({
            positionId: position.id,
            symbol: position.symbol,
            exchange: position.exchange,
            ok: true,
            action: "MARKED_CLOSED_ZERO_QTY",
            canceled,
          });
          continue;
        }

        let closeRaw: AnyJson = null;
        let closeExchangeOrderId: string | null = null;
        let closeClientOrderId: string | null = null;
        let exitValue = 0;
        let exitQty = qtyNum;
        let exitPrice = 0;

        if (position.exchange === "BINANCE") {
          const qty = String(position.qty);
          const sold = await binanceMarketSell({
            apiKey: key.apiKey,
            apiSecret,
            symbol: position.symbol,
            qty,
          });

          closeRaw = sold;
          closeExchangeOrderId = String(sold?.orderId ?? "");
          closeClientOrderId = String(sold?.clientOrderId ?? "");

          exitQty = toNum(sold?.executedQty || qtyNum);
          exitValue = toNum(sold?.cummulativeQuoteQty);
          if (exitValue <= 0) {
            const fills = Array.isArray(sold?.fills) ? sold.fills : [];
            exitValue = fills.reduce((sum: number, f: AnyJson) => {
              return sum + toNum(f?.price) * toNum(f?.qty);
            }, 0);
          }
          exitPrice = exitQty > 0 ? exitValue / exitQty : 0;
        } else {
          const qty = String(position.qty);
          const clientOrderId = `close_${Date.now()}_${position.symbol}`.slice(0, 36);

          const sold = await bybitMarketSell({
            base: bybitBaseFromLabel(key.label),
            apiKey: key.apiKey,
            apiSecret,
            symbol: position.symbol,
            qty,
            clientOrderId,
          });

          closeRaw = sold;
          closeExchangeOrderId = String(sold?.result?.orderId || "");
          closeClientOrderId = clientOrderId;

          const live = await bybitGetOrderRealtime({
            apiKey: key.apiKey,
            apiSecret,
            isDemo: /demo/i.test(key.label || ""),
            symbol: position.symbol,
            orderId: closeExchangeOrderId,
            clientOrderId,
          });

          exitQty = toNum(live?.cumExecQty || qtyNum);
          exitValue = toNum(live?.cumExecValue);
          exitPrice =
            toNum(live?.avgPrice) || (exitQty > 0 && exitValue > 0 ? exitValue / exitQty : 0);
        }

        const entryValue = toNum(position.investedQuote);
        const avgEntryPrice = toNum(position.avgPrice);
        const pnl = exitValue - entryValue;
        const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;
        const closeTime = new Date();

        await insertCloseOrderRow({
          userId: user.id,
          botPositionId: position.id,
          exchange: position.exchange as "BINANCE" | "BYBIT",
          symbol: position.symbol,
          qty: String(exitQty),
          price: exitPrice > 0 ? exitPrice.toFixed(18) : null,
          exchangeOrderId: closeExchangeOrderId,
          clientOrderId: closeClientOrderId,
          rawOrder: closeRaw,
        });

        await prisma.botTrade.create({
          data: {
            user: { connect: { id: user.id } },
            botPosition: { connect: { id: position.id } },
            exchange: position.exchange,
            symbol: position.symbol,
            entryValue: new Prisma.Decimal(entryValue.toFixed(18)),
            exitValue: new Prisma.Decimal(exitValue.toFixed(18)),
            qty: new Prisma.Decimal(exitQty.toFixed(18)),
            avgEntryPrice: new Prisma.Decimal(avgEntryPrice.toFixed(18)),
            exitPrice: new Prisma.Decimal(exitPrice.toFixed(18)),
            pnl: new Prisma.Decimal(pnl.toFixed(18)),
            pnlPercent: new Prisma.Decimal(pnlPercent.toFixed(18)),
            addsCount: position.addsCount,
            closeReason: "MANUAL",
            openedAt: position.openedAt,
            closedAt: closeTime,
          },
        });

        await prisma.botPosition.update({
          where: { id: position.id },
          data: {
            status: "CLOSED",
            closedAt: closeTime,
          },
        });

        results.push({
          positionId: position.id,
          symbol: position.symbol,
          exchange: position.exchange,
          ok: true,
          action: "CLOSED",
          canceled,
          close: {
            orderId: closeExchangeOrderId,
            clientOrderId: closeClientOrderId,
            qty: exitQty,
            exitValue,
            exitPrice,
            pnl,
            pnlPercent,
          },
        });
      } catch (e: any) {
        results.push({
          positionId: position.id,
          symbol: position.symbol,
          exchange: position.exchange,
          ok: false,
          error: "CLOSE_ERROR",
          message: String(e?.message || e),
        });
      }
    }

    let purgeResult: AnyJson = null;

    if (purge) {
      const stillOpen = await prisma.botPosition.count({
        where: {
          userId: user.id,
          status: "OPEN",
        },
      });

      if (stillOpen > 0) {
        purgeResult = {
          ok: false,
          error: "PURGE_BLOCKED",
          message: "There are still open positions. History was not deleted.",
          stillOpen,
        };
      } else {
        const deletedBotTrades = await prisma.botTrade.deleteMany({
          where: { userId: user.id },
        });

        const deletedBotOrders = await prisma.botOrder.deleteMany({
          where: { userId: user.id },
        });

        const deletedBotPositions = await prisma.botPosition.deleteMany({
          where: { userId: user.id },
        });

        const deletedEngineCycles = await prisma.engineCycle.deleteMany({
          where: { userId: user.id },
        });

        const deletedCooldowns = await prisma.cooldownSymbol.deleteMany({
          where: { userId: user.id },
        });

        await prisma.botState.updateMany({
          where: { userId: user.id },
          data: {
            lastError: null,
            lastSyncAt: null,
          },
        });

        purgeResult = {
          ok: true,
          deleted: {
            botTrades: deletedBotTrades.count,
            botOrders: deletedBotOrders.count,
            botPositions: deletedBotPositions.count,
            engineCycles: deletedEngineCycles.count,
            cooldowns: deletedCooldowns.count,
          },
        };
      }
    }

    return json({
      ok: true,
      closed: results,
      purge: purgeResult,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
        message: e?.message ?? String(e),
      },
      { status }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}