import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { prisma } from "@/lib/db";
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

async function bybitGetWalletCoins(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
}) {
  const wallet = await bybitGet({
    base: params.base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/account/wallet-balance",
    query: "accountType=UNIFIED",
  });

  const accounts = Array.isArray(wallet?.result?.list) ? wallet.result.list : [];
  const first = accounts[0] ?? null;
  return Array.isArray(first?.coin) ? first.coin : [];
}

async function bybitGetSymbolFilters(params: {
  base: string;
  symbol: string;
}) {
  const r = await fetch(
    `${params.base}/v5/market/instruments-info?category=spot&symbol=${encodeURIComponent(params.symbol)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const text = await r.text();
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok || data?.retCode !== 0) {
    throw new Error(data?.retMsg || text || `Bybit instruments error: ${r.status}`);
  }

  const sym = Array.isArray(data?.result?.list) ? data.result.list[0] : null;
  if (!sym) {
    throw new Error(`BYBIT_SYMBOL_NOT_FOUND_${params.symbol}`);
  }

  const lot = sym?.lotSizeFilter ?? {};

  return {
    minQty: toNum(lot?.minOrderQty || "0"),
    stepSize: toNum(lot?.basePrecision || lot?.qtyStep || "0.000001"),
  };
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

async function insertClosedTrade(args: {
  userId: string;
  botPositionId: string;
  exchange: string;
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
  const tradeId = crypto.randomUUID();
  const closeReason = "MANUAL";

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "BotTrade" (
      "id",
      "userId",
      "botPositionId",
      "exchange",
      "symbol",
      "entryValue",
      "exitValue",
      "qty",
      "avgEntryPrice",
      "exitPrice",
      "pnl",
      "pnlPercent",
      "addsCount",
      "closeReason",
      "openedAt",
      "closedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${tradeId},
      ${args.userId},
      ${args.botPositionId},
      ${args.exchange}::"Exchange",
      ${args.symbol},
      ${args.entryValue.toFixed(18)}::numeric,
      ${args.exitValue.toFixed(18)}::numeric,
      ${args.qty.toFixed(18)}::numeric,
      ${args.avgEntryPrice.toFixed(18)}::numeric,
      ${args.exitPrice.toFixed(18)}::numeric,
      ${args.pnl.toFixed(18)}::numeric,
      ${args.pnlPercent.toFixed(18)}::numeric,
      ${args.addsCount},
      ${closeReason}::"BotCloseReason",
      ${args.openedAt},
      ${args.closedAt},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  return tradeId;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const positions = await prisma.botPosition.findMany({
      where: {
        userId: user.id,
        status: "OPEN",
      },
      orderBy: { openedAt: "asc" },
    });

    const results: AnyJson[] = [];

    for (const p of positions) {
      let entryValue = toNum(p.investedQuote);
      let exitValue = 0;
      let exitQty = toNum(p.qty);
      let exitPrice = 0;
      let canceledOrdersCount = 0;
      let closeTime = new Date();
      let tradeWriteError: string | null = null;
      let notifyError: string | null = null;
      let tradeId: string | null = null;

      try {
        const key = await prisma.userKey.findFirst({
          where: {
            userId: user.id,
            exchange: p.exchange,
          },
          orderBy: { updatedAt: "desc" },
        });

        if (!key) {
          throw new Error("NO_KEY");
        }

        const secret = decryptString(key.secretEnc);

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
          const base = bybitBase(key.label ?? null);

          await bybitCancelAllBySymbol({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
          });

          await sleep(1200);

          const baseCoin = p.symbol.replace(/USDT$/, "");
          const walletCoins = await bybitGetWalletCoins({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
          });

          const coinRow = walletCoins.find(
            (c: AnyJson) => String(c?.coin || "").toUpperCase() === baseCoin.toUpperCase()
          );

          const freeCoin = Math.max(
            0,
            toNum(coinRow?.walletBalance) - toNum(coinRow?.locked)
          );

          const filters = await bybitGetSymbolFilters({
            base,
            symbol: p.symbol,
          });

          const sellQtyNum = floorToStep(freeCoin, filters.stepSize);

          if (sellQtyNum < filters.minQty || sellQtyNum <= 0) {
            throw new Error(
              `BYBIT_NOT_ENOUGH_FREE_BALANCE_${baseCoin}_free=${freeCoin}_sellQty=${sellQtyNum}`
            );
          }

          const sellQty = formatByStep(sellQtyNum, filters.stepSize);
          const cid = `close_${Date.now()}_${p.symbol}`.slice(0, 36);

          const created = await bybitMarketSell({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
            qty: sellQty,
            clientOrderId: cid,
          });

          const orderId = String(created?.result?.orderId || "");
          if (!orderId) {
            throw new Error("BYBIT_CLOSE_ORDER_ID_MISSING");
          }

          for (let i = 0; i < 12; i++) {
            await sleep(700);

            const row = await bybitGetOrder({
              base,
              apiKey: key.apiKey,
              apiSecret: secret,
              symbol: p.symbol,
              orderId,
            });

            if (!row) continue;

            exitQty = toNum(row?.cumExecQty || sellQtyNum);
            exitValue = toNum(row?.cumExecValue);
            exitPrice =
              toNum(row?.avgPrice) || (exitQty > 0 ? exitValue / exitQty : 0);

            const status = String(row?.orderStatus || "");
            if (status === "Filled") {
              break;
            }

            if (["Rejected", "Cancelled", "Deactivated"].includes(status)) {
              throw new Error(`BYBIT_CLOSE_FAILED_${status}`);
            }
          }

          if (exitQty <= 0 || exitValue <= 0) {
            throw new Error("BYBIT_CLOSE_NOT_CONFIRMED");
          }
        } else {
          throw new Error(`UNSUPPORTED_EXCHANGE_${String(p.exchange)}`);
        }

        canceledOrdersCount = await cancelTrackedOrdersForPosition(p.id);
        closeTime = new Date();

        const pnl = exitValue - entryValue;
        const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

        try {
          tradeId = await insertClosedTrade({
            userId: user.id,
            botPositionId: p.id,
            exchange: String(p.exchange),
            symbol: p.symbol,
            entryValue,
            exitValue,
            qty: exitQty,
            avgEntryPrice: Number(p.avgPrice),
            exitPrice,
            pnl,
            pnlPercent,
            addsCount: p.addsCount,
            openedAt: p.openedAt,
            closedAt: closeTime,
          });
        } catch (e: any) {
          tradeWriteError = String(e?.message || e);
        }

        await prisma.botPosition.update({
          where: { id: p.id },
          data: {
            status: "CLOSED",
            closedAt: closeTime,
          },
        });

        try {
          await notifyTradeClosed({
            userId: user.id,
            symbol: p.symbol,
            positionId: p.id,
            avgEntryPrice: Number(p.avgPrice),
            exitPrice,
            qty: exitQty,
            entryValue,
            exitValue,
            pnl,
          });
        } catch (e: any) {
          notifyError = String(e?.message || e);
        }

        results.push({
          symbol: p.symbol,
          exchange: p.exchange,
          ok: true,
          tradeId,
          canceledOrdersCount,
          entryValue,
          exitValue,
          exitPrice,
          qty: exitQty,
          pnl,
          pnlPercent,
          tradeWriteError,
          notifyError,
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