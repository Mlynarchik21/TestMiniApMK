import crypto from "crypto";
import type {
  ExchangeAdapter,
  ExchangeBalance,
  ExchangeFilters,
  LimitOrderResult,
  MarketOrderResult,
  OrderStatusResult,
} from "@/lib/exchanges/types";

const BYBIT_BASE =
  process.env.BYBIT_BASE_URL?.trim() || "https://api-demo.bybit.com";

const STABLE_ASSETS = new Set(["USDT", "USDC"]);

type AnyJson = any;

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function signPost(
  apiKey: string,
  apiSecret: string,
  recvWindow: string,
  timestamp: string,
  body: string
) {
  const payload = `${timestamp}${apiKey}${recvWindow}${body}`;
  return crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
}

function normalizeBybitStatus(status: unknown): string {
  const s = String(status || "").trim().toUpperCase();

  if (!s) return "UNKNOWN";
  if (s === "FILLED") return "FILLED";
  if (s === "PARTIALLYFILLED" || s === "PARTIALLY_FILLED") return "PARTIALLY_FILLED";
  if (
    s === "NEW" ||
    s === "CREATED" ||
    s === "UNTRIGGERED" ||
    s === "ACTIVE"
  ) {
    return "NEW";
  }
  if (
    s === "CANCELLED" ||
    s === "CANCELED" ||
    s === "DEACTIVATED"
  ) {
    return "CANCELED";
  }
  if (s === "REJECTED" || s === "FAILED") return "REJECTED";

  return s;
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

async function bybitPrivatePost<T = AnyJson>(params: {
  apiKey: string;
  apiSecret: string;
  path: string;
  body: Record<string, any>;
}): Promise<T> {
  const recvWindow = "5000";
  const timestamp = String(Date.now());
  const bodyStr = JSON.stringify(params.body);
  const sign = signPost(params.apiKey, params.apiSecret, recvWindow, timestamp, bodyStr);

  const res = await fetch(`${BYBIT_BASE}${params.path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-BAPI-API-KEY": params.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": sign,
    },
    body: bodyStr,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.retCode !== 0) {
    throw new Error(json?.retMsg || `Bybit POST error: ${res.status}`);
  }

  return json as T;
}

async function bybitPublicGet<T = AnyJson>(
  path: string,
  query?: Record<string, string | number | undefined | null>
) {
  const qs = buildQuery(query || {});
  const url = `${BYBIT_BASE}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.retCode !== 0) {
    throw new Error(json?.retMsg || `Bybit public GET error: ${res.status}`);
  }

  return json as T;
}

async function readBybitRealtimeOrder(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  exchangeOrderId?: string | null;
  clientOrderId?: string | null;
}) {
  const json: AnyJson = await bybitPrivateGet({
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    path: "/v5/order/realtime",
    query: {
      category: "spot",
      symbol: params.symbol,
      orderId: params.exchangeOrderId,
      orderLinkId: params.clientOrderId,
      openOnly: 0,
    },
  });

  const list = Array.isArray(json?.result?.list) ? json.result.list : [];
  const row = list[0] ?? null;

  return { json, row };
}

function safeSellQty(qty: number, stepSize: number, minQty: number) {
  let q = floorToStep(qty, stepSize);

  if (stepSize > 0) {
    const shaved = floorToStep(q - stepSize, stepSize);
    if (shaved >= minQty) q = shaved;
  }

  return q;
}

export const bybitAdapter: ExchangeAdapter = {
  name: "BYBIT",

  async getBalance(apiKey, apiSecret): Promise<ExchangeBalance> {
    const json: AnyJson = await bybitPrivateGet({
      apiKey,
      apiSecret,
      path: "/v5/account/wallet-balance",
      query: {
        accountType: "UNIFIED",
        coin: "USDT,USDC",
      },
    });

    const accounts = Array.isArray(json?.result?.list) ? json.result.list : [];
    const first = accounts[0];
    const coins = Array.isArray(first?.coin) ? first.coin : [];

    let totalStable = 0;
    let freeStable = 0;
    let lockedStable = 0;

    for (const c of coins) {
      const coin = String(c?.coin || "");
      if (!STABLE_ASSETS.has(coin)) continue;

      const walletBalance = toNum(c?.walletBalance);
      const locked = toNum(c?.locked);
      const free = Math.max(0, walletBalance - locked);

      totalStable += walletBalance;
      freeStable += free;
      lockedStable += locked;
    }

    return { totalStable, freeStable, lockedStable };
  },

  async getSymbolFilters(symbol): Promise<ExchangeFilters> {
    const json: AnyJson = await bybitPublicGet("/v5/market/instruments-info", {
      category: "spot",
      symbol,
    });

    const row = Array.isArray(json?.result?.list) ? json.result.list[0] : null;
    if (!row) throw new Error(`Bybit symbol ${symbol} not found`);

    const tickSize = toNum(row?.priceFilter?.tickSize || "0.0001");
    const stepSize = toNum(
      row?.lotSizeFilter?.basePrecision ||
        row?.lotSizeFilter?.qtyStep ||
        "0.000001"
    );
    const minQty = toNum(row?.lotSizeFilter?.minOrderQty || "0");
    const minNotional = toNum(row?.lotSizeFilter?.minOrderAmt || "0");

    return {
      tickSize,
      stepSize,
      minQty,
      minNotional,
    };
  },

  async placeMarketBuy(params): Promise<MarketOrderResult> {
    const clientOrderId = (
      params.clientOrderId || `entry_${Date.now()}_${params.symbol}`
    ).slice(0, 36);

    const json: AnyJson = await bybitPrivatePost({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      path: "/v5/order/create",
      body: {
        category: "spot",
        symbol: params.symbol,
        side: "Buy",
        orderType: "Market",
        qty: String(params.quoteAmount),
        marketUnit: "quoteCoin",
        orderLinkId: clientOrderId,
        orderFilter: "Order",
      },
    });

    const orderId = String(json?.result?.orderId || "");

    let status = await this.getOrderStatus({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      symbol: params.symbol,
      exchangeOrderId: orderId,
      clientOrderId,
    });

    for (let i = 0; i < 8; i++) {
      if (
        status.status === "FILLED" ||
        status.status === "PARTIALLY_FILLED" ||
        status.status === "REJECTED" ||
        status.status === "CANCELED"
      ) {
        break;
      }

      await sleep(500);

      status = await this.getOrderStatus({
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        symbol: params.symbol,
        exchangeOrderId: orderId,
        clientOrderId,
      });
    }

    return {
      exchangeOrderId: orderId,
      clientOrderId,
      status: status.status,
      executedQty: status.executedQty,
      quoteSpent: status.cumQuote,
      avgPrice: status.avgPrice,
      raw: { create: json, status: status.raw },
    };
  },

  async placeLimitOrder(params): Promise<LimitOrderResult> {
    const filters = await this.getSymbolFilters(params.symbol);

    let qtyNum = floorToStep(params.qty, filters.stepSize);

    if (params.side === "SELL") {
      qtyNum = safeSellQty(qtyNum, filters.stepSize, filters.minQty);
    }

    if (qtyNum < filters.minQty) {
      throw new Error(
        `Bybit ${params.side} qty below minQty after rounding: qty=${qtyNum}, minQty=${filters.minQty}`
      );
    }

    const qty = formatByStep(qtyNum, filters.stepSize);
    const price = formatByStep(params.price, filters.tickSize);
    const clientOrderId = (
      params.clientOrderId || `ord_${Date.now()}_${params.symbol}`
    ).slice(0, 36);

    const json: AnyJson = await bybitPrivatePost({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      path: "/v5/order/create",
      body: {
        category: "spot",
        symbol: params.symbol,
        side: params.side === "BUY" ? "Buy" : "Sell",
        orderType: "Limit",
        timeInForce: "GTC",
        qty,
        price,
        orderLinkId: clientOrderId,
        orderFilter: "Order",
      },
    });

    const orderId = String(json?.result?.orderId || "");

    let live = await this.getOrderStatus({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      symbol: params.symbol,
      exchangeOrderId: orderId,
      clientOrderId,
    });

    for (let i = 0; i < 6; i++) {
      if (
        live.status === "NEW" ||
        live.status === "PARTIALLY_FILLED" ||
        live.status === "FILLED" ||
        live.status === "REJECTED" ||
        live.status === "CANCELED"
      ) {
        break;
      }

      await sleep(400);

      live = await this.getOrderStatus({
        apiKey: params.apiKey,
        apiSecret: params.apiSecret,
        symbol: params.symbol,
        exchangeOrderId: orderId,
        clientOrderId,
      });
    }

    return {
      exchangeOrderId: orderId,
      clientOrderId,
      status: live.status || "NEW",
      price: Number(price),
      qty: Number(qty),
      raw: { create: json, status: live.raw },
    };
  },

  async getOrderStatus(params): Promise<OrderStatusResult> {
    const { json, row } = await readBybitRealtimeOrder({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      symbol: params.symbol,
      exchangeOrderId: params.exchangeOrderId,
      clientOrderId: params.clientOrderId,
    });

    if (!row) {
      return {
        exchangeOrderId: String(params.exchangeOrderId || ""),
        clientOrderId: params.clientOrderId ?? null,
        status: "UNKNOWN",
        executedQty: 0,
        cumQuote: 0,
        avgPrice: 0,
        raw: json,
      };
    }

    const executedQty = toNum(row?.cumExecQty);
    const cumQuote = toNum(row?.cumExecValue);
    const avgPrice =
      toNum(row?.avgPrice) || (executedQty > 0 ? cumQuote / executedQty : 0);

    return {
      exchangeOrderId: String(row?.orderId || params.exchangeOrderId || ""),
      clientOrderId: row?.orderLinkId ?? params.clientOrderId ?? null,
      status: normalizeBybitStatus(row?.orderStatus),
      executedQty,
      cumQuote,
      avgPrice,
      raw: row,
    };
  },

  async cancelOrder(params) {
    const json: AnyJson = await bybitPrivatePost({
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      path: "/v5/order/cancel",
      body: {
        category: "spot",
        symbol: params.symbol,
        ...(params.exchangeOrderId ? { orderId: params.exchangeOrderId } : {}),
        ...(params.clientOrderId ? { orderLinkId: params.clientOrderId } : {}),
        orderFilter: "Order",
      },
    });

    return json;
  },
};