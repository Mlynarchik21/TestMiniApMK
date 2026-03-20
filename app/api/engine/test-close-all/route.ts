import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { notifyTradeClosed } from "@/lib/notifications/telegram";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function floorStep(v: number, step = 0.000001) {
  if (!Number.isFinite(v) || !Number.isFinite(step) || step <= 0) return v;
  return Math.floor(v / step) * step;
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

async function binanceMarketSell(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  qty: number;
}) {
  const serverTime = await binanceServerTime();
  const safeQty = floorStep(params.qty).toFixed(6);

  const qs = new URLSearchParams({
    symbol: params.symbol,
    side: "SELL",
    type: "MARKET",
    quantity: safeQty,
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const sig = signBinance(qs, params.apiSecret);

  const r = await fetch(
    `https://testnet.binance.vision/api/v3/order?${qs}&signature=${sig}`,
    {
      method: "POST",
      headers: { "X-MBX-APIKEY": params.apiKey },
      cache: "no-store",
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

async function bybitPost(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  path: string;
  body: AnyJson;
}) {
  const ts = String(Date.now());
  const recv = "10000";
  const bodyStr = JSON.stringify(params.body);

  const sign = bybitSign({
    timestamp: ts,
    apiKey: params.apiKey,
    recvWindow: recv,
    payload: bodyStr,
    secret: params.apiSecret,
  });

  const r = await fetch(params.base + params.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sign,
    },
    body: bodyStr,
    cache: "no-store",
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

async function bybitGet(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  path: string;
  query: string;
}) {
  const ts = String(Date.now());
  const recv = "10000";

  const sign = bybitSign({
    timestamp: ts,
    apiKey: params.apiKey,
    recvWindow: recv,
    payload: params.query,
    secret: params.apiSecret,
  });

  const r = await fetch(`${params.base}${params.path}?${params.query}`, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sign,
    },
    cache: "no-store",
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

async function bybitGetOrder(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  orderId: string;
}) {
  const live = await bybitGet({
    base: params.base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/realtime",
    query: `category=spot&symbol=${encodeURIComponent(params.symbol)}&orderId=${encodeURIComponent(params.orderId)}`,
  });

  return live?.result?.list?.[0] ?? null;
}

function bybitBase(label: string | null) {
  return /demo/i.test(label || "")
    ? "https://api-demo.bybit.com"
    : "https://api.bybit.com";
}

async function bybitCancelAllBySymbol(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
}) {
  return bybitPost({
    base: params.base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/cancel-all",
    body: {
      category: "spot",
      symbol: params.symbol,
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

async function cancelTrackedOrdersForPosition(positionId: string) {
  const openOrders = await prisma.$queryRaw<
    Array<{
      id: string;
      status: string;
    }>
  >(Prisma.sql`
    SELECT "id", "status"
    FROM "BotOrder"
    WHERE "botPositionId" = ${positionId}
      AND "status" IN ('NEW', 'PLACED', 'PARTIALLY_FILLED')
  `);

  for (const ord of openOrders) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "BotOrder"
      SET
        "status" = 'CANCELED',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${ord.id}
    `);
  }

  return openOrders.length;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const positions = await prisma.botPosition.findMany({
      where: { userId: user.id, status: "OPEN" },
      orderBy: { openedAt: "asc" },
    });

    const results: AnyJson[] = [];

    for (const p of positions) {
      try {
        const key = await prisma.userKey.findFirst({
          where: { userId: user.id, exchange: p.exchange },
          orderBy: { updatedAt: "desc" },
        });

        if (!key) {
          throw new Error("NO_KEY");
        }

        const secret = decryptString(key.secretEnc);

        let exitValue = 0;
        let exitQty = toNum(p.qty);
        let exitPrice = 0;
        let canceledOrdersCount = 0;

        if (p.exchange === "BINANCE") {
          const res = await binanceMarketSell({
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
            qty: exitQty,
          });

          exitQty = toNum(res?.executedQty || exitQty);
          exitValue = toNum(res?.cummulativeQuoteQty);

          if (exitValue <= 0) {
            const fills = Array.isArray(res?.fills) ? res.fills : [];
            exitValue = fills.reduce((sum: number, f: AnyJson) => {
              return sum + toNum(f?.price) * toNum(f?.qty);
            }, 0);
          }

          exitPrice = exitQty > 0 ? exitValue / exitQty : 0;
        } else if (p.exchange === "BYBIT") {
          const base = bybitBase(key.label);

          await bybitCancelAllBySymbol({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
          });

          const cid = `close_${Date.now()}_${p.symbol}`.slice(0, 36);

          const created = await bybitMarketSell({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
            qty: String(exitQty),
            clientOrderId: cid,
          });

          const orderId = String(created?.result?.orderId || "");
          if (!orderId) {
            throw new Error("BYBIT_CLOSE_ORDER_ID_MISSING");
          }

          for (let i = 0; i < 10; i++) {
            await sleep(500);

            const row = await bybitGetOrder({
              base,
              apiKey: key.apiKey,
              apiSecret: secret,
              symbol: p.symbol,
              orderId,
            });

            if (!row) continue;

            exitQty = toNum(row?.cumExecQty || exitQty);
            exitValue = toNum(row?.cumExecValue);
            exitPrice =
              toNum(row?.avgPrice) || (exitQty > 0 ? exitValue / exitQty : 0);

            if (String(row?.orderStatus || "") === "Filled") {
              break;
            }
          }
        } else {
          throw new Error(`UNSUPPORTED_EXCHANGE_${String(p.exchange)}`);
        }

        canceledOrdersCount = await cancelTrackedOrdersForPosition(p.id);

        const entry = toNum(p.investedQuote);
        const pnl = exitValue - entry;
        const pnlPercent = entry > 0 ? (pnl / entry) * 100 : 0;
        const closeTime = new Date();

        await prisma.botTrade.create({
          data: {
            userId: user.id,
            botPositionId: p.id,
            exchange: p.exchange,
            symbol: p.symbol,
            entryValue: new Prisma.Decimal(entry.toFixed(18)),
            exitValue: new Prisma.Decimal(exitValue.toFixed(18)),
            qty: new Prisma.Decimal(exitQty.toFixed(18)),
            avgEntryPrice: new Prisma.Decimal(Number(p.avgPrice).toFixed(18)),
            exitPrice: new Prisma.Decimal(exitPrice.toFixed(18)),
            pnl: new Prisma.Decimal(pnl.toFixed(18)),
            pnlPercent: new Prisma.Decimal(pnlPercent.toFixed(18)),
            addsCount: p.addsCount,
            closeReason: "MANUAL",
            openedAt: p.openedAt,
            closedAt: closeTime,
          },
        });

        await prisma.botPosition.update({
          where: { id: p.id },
          data: {
            status: "CLOSED",
            closedAt: closeTime,
          },
        });

        await notifyTradeClosed({
          userId: user.id,
          symbol: p.symbol,
          positionId: p.id,
          avgEntryPrice: Number(p.avgPrice),
          exitPrice,
          qty: exitQty,
          entryValue: entry,
          exitValue,
          pnl,
        });

        results.push({
          symbol: p.symbol,
          exchange: p.exchange,
          ok: true,
          canceledOrdersCount,
          entryValue: entry,
          exitValue,
          exitPrice,
          qty: exitQty,
          pnl,
          pnlPercent,
        });
      } catch (e: any) {
        results.push({
          symbol: p.symbol,
          exchange: p.exchange,
          ok: false,
          error: String(e?.message || e),
        });
      }
    }

    return json({ ok: true, results });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}