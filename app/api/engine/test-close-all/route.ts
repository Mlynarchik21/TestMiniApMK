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

function floorStep(v: number, step = 0.000001) {
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
  const r = await fetch("https://testnet.binance.vision/api/v3/time");
  const j = await r.json();
  return Number(j.serverTime);
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
    }
  );

  return r.json();
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
  });

  return r.json();
}

async function bybitGetOrder(params: {
  base: string;
  apiKey: string;
  apiSecret: string;
  symbol: string;
  orderId: string;
}) {
  const ts = String(Date.now());
  const recv = "10000";

  const query = `category=spot&symbol=${params.symbol}&orderId=${params.orderId}`;

  const sign = bybitSign({
    timestamp: ts,
    apiKey: params.apiKey,
    recvWindow: recv,
    payload: query,
    secret: params.apiSecret,
  });

  const r = await fetch(`${params.base}/v5/order/realtime?${query}`, {
    headers: {
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recv,
      "X-BAPI-SIGN": sign,
    },
  });

  const j = await r.json();
  return j?.result?.list?.[0] ?? null;
}

function bybitBase(label: string | null) {
  return /demo/i.test(label || "")
    ? "https://api-demo.bybit.com"
    : "https://api.bybit.com";
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const positions = await prisma.botPosition.findMany({
      where: { userId: user.id, status: "OPEN" },
    });

    const results: any[] = [];

    for (const p of positions) {
      try {
        const key = await prisma.userKey.findFirst({
          where: { userId: user.id, exchange: p.exchange },
        });

        if (!key) throw new Error("NO_KEY");

        const secret = decryptString(key.secretEnc);

        let exitValue = 0;
        let exitQty = toNum(p.qty);
        let exitPrice = 0;

        if (p.exchange === "BINANCE") {
          const res = await binanceMarketSell({
            apiKey: key.apiKey,
            apiSecret: secret,
            symbol: p.symbol,
            qty: exitQty,
          });

          exitQty = toNum(res.executedQty);
          exitValue = toNum(res.cummulativeQuoteQty);
          exitPrice = exitQty > 0 ? exitValue / exitQty : 0;
        } else {
          const base = bybitBase(key.label);
          const cid = `close_${Date.now()}`;

          const created = await bybitPost({
            base,
            apiKey: key.apiKey,
            apiSecret: secret,
            path: "/v5/order/create",
            body: {
              category: "spot",
              symbol: p.symbol,
              side: "Sell",
              orderType: "Market",
              qty: String(exitQty),
              orderLinkId: cid,
            },
          });

          const orderId = created?.result?.orderId;

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

            exitQty = toNum(row.cumExecQty);
            exitValue = toNum(row.cumExecValue);
            exitPrice =
              toNum(row.avgPrice) ||
              (exitQty > 0 ? exitValue / exitQty : 0);

            if (row.orderStatus === "Filled") break;
          }
        }

        const entry = toNum(p.investedQuote);
        const pnl = exitValue - entry;
        const pnlPercent = entry > 0 ? (pnl / entry) * 100 : 0;

        await prisma.botTrade.create({
          data: {
            userId: user.id,
            botPositionId: p.id,
            exchange: p.exchange,
            symbol: p.symbol,
            entryValue: new Prisma.Decimal(entry),
            exitValue: new Prisma.Decimal(exitValue),
            qty: new Prisma.Decimal(exitQty),
            avgEntryPrice: p.avgPrice,
            exitPrice: new Prisma.Decimal(exitPrice),
            pnl: new Prisma.Decimal(pnl),
            pnlPercent: new Prisma.Decimal(pnlPercent),
            addsCount: p.addsCount,
            closeReason: "MANUAL",
            openedAt: p.openedAt,
            closedAt: new Date(),
          },
        });

        await prisma.botPosition.update({
          where: { id: p.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
          },
        });

        results.push({
          symbol: p.symbol,
          ok: true,
          pnl,
        });
      } catch (e: any) {
        results.push({
          symbol: p.symbol,
          ok: false,
          error: e.message,
        });
      }
    }

    return json({ ok: true, results });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}