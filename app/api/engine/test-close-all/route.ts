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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

function baseAssetFromSymbol(symbol: string) {
  return symbol.replace(/USDT$/i, "");
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

  const j = await r.json().catch(() => null);
  const t = Number(j?.serverTime);
  if (!Number.isFinite(t)) {
    throw new Error("Binance serverTime missing");
  }
  return t;
}

async function binancePrivateRequest(params: {
  apiKey: string;
  apiSecret: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined | null>;
}) {
  const serverTime = await binanceServerTime();

  const usp = new URLSearchParams({
    timestamp: String(serverTime),
    recvWindow: "10000",
  });

  for (const [k, v] of Object.entries(params.query || {})) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }

  const qs = usp.toString();
  const sig = signBinance(qs, params.apiSecret);

  const r = await fetch(
    `https://testnet.binance.vision${params.path}?${qs}&signature=${sig}`,
    {
      method: params.method,
      cache: "no-store",
      headers: { "X-MBX-APIKEY": params.apiKey },
    }
  );

  const text = await r.text();
  let data: AnyJson = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(data?.msg || text || `Binance ${params.method} error: ${r.status}`);
  }

  return data;
}

async function binanceCancelAllOpenOrders(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
}) {
  return binancePrivateRequest({
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    method: "DELETE",
    path: "/api/v3/openOrders",
    query: { symbol: params.symbol },
  });
}

async function getBinanceSymbolStepSize(symbol: string) {
  const r = await fetch(
    `https://testnet.binance.vision/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const j = await r.json().catch(() => null);
  const sym = Array.isArray(j?.symbols) ? j.symbols[0] : null;
  const filters = Array.isArray(sym?.filters) ? sym.filters : [];
  const lotSize = filters.find((f: AnyJson) => f?.filterType === "LOT_SIZE");

  return toNum(lotSize?.stepSize || "0.000001");
}

async function binanceGetBaseAssetFree(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
}) {
  const account = await binancePrivateRequest({
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    method: "GET",
    path: "/api/v3/account",
  });

  const asset = baseAssetFromSymbol(params.symbol).toUpperCase();
  const balances = Array.isArray(account?.balances) ? account.balances : [];
  const row = balances.find((x: AnyJson) => String(x?.asset || "").toUpperCase() === asset);

  return toNum(row?.free);
}

async function binanceMarketSell(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  qty: number;
}) {
  const step = await getBinanceSymbolStepSize(params.symbol);
  const safeQty = formatByStep(params.qty, step);

  return binancePrivateRequest({
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    method: "POST",
    path: "/api/v3/order",
    query: {
      symbol: params.symbol,
      side: "SELL",
      type: "MARKET",
      quantity: safeQty,
      newOrderRespType: "FULL",
    },
  });
}

function bybitBase(label: string | null) {
  return /demo/i.test(label || "")
    ? "https://api-demo.bybit.com"
    : "https://api.bybit.com";
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
    cache: "no-store",
    headers: {
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sign,
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
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sign,
    },
    body: bodyStr,
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

  const j = await r.json().catch(() => null);
  if (!r.ok || j?.retCode !== 0) {
    throw new Error(j?.retMsg || `Bybit instruments error: ${r.status}`);
  }

  const row = Array.isArray(j?.result?.list) ? j.result.list[0] : null;
  if (!row) throw new Error(`Bybit symbol ${params.symbol} not found`);

  const stepSize = toNum(
    row?.lotSizeFilter?.basePrecision || row?.lotSizeFilter?.qtyStep || "0.000001"
  );
  const minQty = toNum(row?.lotSizeFilter?.minOrderQty || "0");

  return { stepSize, minQty };
}

async function bybitGetBaseAssetFree(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
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
  const coins = Array.isArray(first?.coin) ? first.coin : [];
  const asset = baseAssetFromSymbol(params.symbol).toUpperCase();

  const row = coins.find((x: AnyJson) => String(x?.coin || "").toUpperCase() === asset);
  if (!row) return 0;

  const walletBalance = toNum(row?.walletBalance);
  const locked = toNum(row?.locked);

  return Math.max(walletBalance - locked, 0);
}

async function bybitCancelAllOpenOrders(params: {
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
      orderFilter: "Order",
    },
  });
}

async function bybitMarketSell(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  qty: number;
}) {
  const filters = await bybitGetSymbolFilters({
    base: params.base,
    symbol: params.symbol,
  });

  let safeQtyNum = floorToStep(params.qty, filters.stepSize);

  const shaved = floorToStep(safeQtyNum - filters.stepSize, filters.stepSize);
  if (shaved >= filters.minQty) {
    safeQtyNum = shaved;
  }

  if (safeQtyNum < filters.minQty) {
    throw new Error(
      `Bybit sell qty too small after rounding: qty=${safeQtyNum}, minQty=${filters.minQty}`
    );
  }

  const clientOrderId = `close_${Date.now()}_${params.symbol}`.slice(0, 36);

  const created = await bybitPost({
    base: params.base,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/create",
    body: {
      category: "spot",
      symbol: params.symbol,
      side: "Sell",
      orderType: "Market",
      qty: formatByStep(safeQtyNum, filters.stepSize),
      orderLinkId: clientOrderId,
      orderFilter: "Order",
    },
  });

  const orderId = String(created?.result?.orderId || "");
  if (!orderId) {
    throw new Error("Bybit close market sell created without orderId");
  }

  let exitQty = 0;
  let exitValue = 0;
  let exitPrice = 0;
  let finalStatus = "UNKNOWN";
  let lastRow: AnyJson = null;

  for (let i = 0; i < 12; i++) {
    await sleep(500);

    const live = await bybitGet({
      base: params.base,
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      path: "/v5/order/realtime",
      query: `category=spot&symbol=${encodeURIComponent(params.symbol)}&orderId=${encodeURIComponent(orderId)}&openOnly=0`,
    });

    const list = Array.isArray(live?.result?.list) ? live.result.list : [];
    const row = list[0] ?? null;
    if (!row) continue;

    lastRow = row;
    finalStatus = String(row?.orderStatus || "UNKNOWN");
    exitQty = toNum(row?.cumExecQty);
    exitValue = toNum(row?.cumExecValue);
    exitPrice = toNum(row?.avgPrice) || (exitQty > 0 ? exitValue / exitQty : 0);

    if (finalStatus === "Filled" && exitQty > 0) {
      return {
        orderId,
        clientOrderId,
        exitQty,
        exitValue,
        exitPrice,
        status: finalStatus,
        raw: { create: created, status: row },
      };
    }

    if (["Cancelled", "Rejected", "Deactivated"].includes(finalStatus)) {
      throw new Error(`Bybit market sell failed: ${finalStatus}`);
    }
  }

  throw new Error(
    `Bybit market sell not filled in time: status=${finalStatus}, row=${JSON.stringify(lastRow)}`
  );
}

async function markOrdersCanceledByPosition(positionId: string) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "BotOrder"
    SET
      "status" = CASE
        WHEN "status" IN ('NEW', 'PLACED', 'PARTIALLY_FILLED') THEN 'CANCELED'
        ELSE "status"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "botPositionId" = ${positionId}
  `);
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
          select: {
            id: true,
            exchange: true,
            label: true,
            apiKey: true,
            secretEnc: true,
          },
        });

        if (!key) {
          if (p.exchange === "BINANCE") {
            await markOrdersCanceledByPosition(p.id);

            await prisma.botPosition.update({
              where: { id: p.id },
              data: {
                status: "CLOSED",
                closedAt: new Date(),
              },
            });

            results.push({
              symbol: p.symbol,
              exchange: p.exchange,
              ok: true,
              action: "FORCE_CLOSED_IN_DB_NO_KEY",
            });
            continue;
          }

          throw new Error("NO_KEY");
        }

        const secret = decryptString(key.secretEnc);

        let exitValue = 0;
        let exitQty = 0;
        let exitPrice = 0;
        let closeRaw: AnyJson = null;

        if (p.exchange === "BINANCE") {
          await binanceCancelAllOpenOrders({
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
          });

          await markOrdersCanceledByPosition(p.id);

          const freeBase = await binanceGetBaseAssetFree({
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
          });

          const qtyToSell = Math.min(toNum(p.qty), freeBase);

          if (qtyToSell <= 0) {
            exitQty = 0;
            exitValue = 0;
            exitPrice = 0;
          } else {
            const sold = await binanceMarketSell({
              apiKey: key.apiKey,
              apiSecret: secret,
              symbol: p.symbol,
              qty: qtyToSell,
            });

            closeRaw = sold;
            exitQty = toNum(sold?.executedQty);
            exitValue = toNum(sold?.cummulativeQuoteQty);

            if (exitValue <= 0) {
              const fills = Array.isArray(sold?.fills) ? sold.fills : [];
              exitValue = fills.reduce((sum: number, f: AnyJson) => {
                return sum + toNum(f?.price) * toNum(f?.qty);
              }, 0);
            }

            exitPrice = exitQty > 0 ? exitValue / exitQty : 0;
          }
        } else if (p.exchange === "BYBIT") {
          const base = bybitBase(key.label);

          await bybitCancelAllOpenOrders({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
          });

          await sleep(700);
          await markOrdersCanceledByPosition(p.id);

          const freeBase = await bybitGetBaseAssetFree({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
          });

          const qtyToSell = Math.min(toNum(p.qty), freeBase);

          if (qtyToSell <= 0) {
            exitQty = 0;
            exitValue = 0;
            exitPrice = 0;
          } else {
            const sold = await bybitMarketSell({
              base,
              apiKey: key.apiKey,
              apiSecret: secret,
              symbol: p.symbol,
              qty: qtyToSell,
            });

            closeRaw = sold.raw;
            exitQty = sold.exitQty;
            exitValue = sold.exitValue;
            exitPrice = sold.exitPrice;
          }
        } else {
          throw new Error(`UNSUPPORTED_EXCHANGE: ${String(p.exchange)}`);
        }

        const entry = toNum(p.investedQuote);
        const pnl = exitValue - entry;
        const pnlPercent = entry > 0 ? (pnl / entry) * 100 : 0;
        const closedAt = new Date();

        await prisma.botTrade.create({
          data: {
            userId: user.id,
            botPositionId: p.id,
            exchange: p.exchange,
            symbol: p.symbol,
            entryValue: new Prisma.Decimal(entry.toFixed(18)),
            exitValue: new Prisma.Decimal(exitValue.toFixed(18)),
            qty: new Prisma.Decimal(exitQty.toFixed(18)),
            avgEntryPrice: p.avgPrice,
            exitPrice: new Prisma.Decimal(exitPrice.toFixed(18)),
            pnl: new Prisma.Decimal(pnl.toFixed(18)),
            pnlPercent: new Prisma.Decimal(pnlPercent.toFixed(18)),
            addsCount: p.addsCount,
            closeReason: "MANUAL",
            openedAt: p.openedAt,
            closedAt,
          },
        });

        await prisma.botPosition.update({
          where: { id: p.id },
          data: {
            status: "CLOSED",
            closedAt,
          },
        });

        results.push({
          symbol: p.symbol,
          exchange: p.exchange,
          ok: true,
          action: "CLOSED_ON_EXCHANGE",
          close: {
            qty: exitQty,
            exitValue,
            exitPrice,
            pnl,
            pnlPercent,
          },
          raw: closeRaw,
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
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}