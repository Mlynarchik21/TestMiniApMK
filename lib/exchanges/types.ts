export type ExchangeName = "BINANCE" | "BYBIT" | "OKX";

export type ExchangeBalance = {
  totalStable: number;
  freeStable: number;
  lockedStable: number;
};

export type ExchangeFilters = {
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
};

export type MarketOrderResult = {
  exchangeOrderId: string;
  clientOrderId?: string | null;
  status: string;
  executedQty: number;
  quoteSpent: number;
  avgPrice: number;
  raw: any;
};

export type LimitOrderResult = {
  exchangeOrderId: string;
  clientOrderId?: string | null;
  status: string;
  price: number;
  qty: number;
  raw: any;
};

export type OrderStatusResult = {
  exchangeOrderId: string;
  clientOrderId?: string | null;
  status: string;
  executedQty: number;
  cumQuote: number;
  avgPrice: number;
  raw: any;
};

export type ExchangeClosedTrade = {
  exchangeOrderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  avgPrice: number;
  quoteQty: number;
  fee?: number;
  feeAsset?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  raw: any;
};

export interface ExchangeAdapter {
  name: ExchangeName;
  getBalance(apiKey: string, apiSecret: string): Promise<ExchangeBalance>;
  getSymbolFilters(symbol: string): Promise<ExchangeFilters>;
  placeMarketBuy(params: {
    apiKey: string;
    apiSecret: string;
    symbol: string;
    quoteAmount: number;
    clientOrderId?: string;
  }): Promise<MarketOrderResult>;
  placeLimitOrder(params: {
    apiKey: string;
    apiSecret: string;
    symbol: string;
    side: "BUY" | "SELL";
    qty: number;
    price: number;
    clientOrderId?: string;
  }): Promise<LimitOrderResult>;
  getOrderStatus(params: {
    apiKey: string;
    apiSecret: string;
    symbol: string;
    exchangeOrderId?: string;
    clientOrderId?: string;
  }): Promise<OrderStatusResult>;
  cancelOrder(params: {
    apiKey: string;
    apiSecret: string;
    symbol: string;
    exchangeOrderId?: string;
    clientOrderId?: string;
  }): Promise<any>;
  getClosedTrades(params: {
    apiKey: string;
    apiSecret: string;
    from: Date;
    to: Date;
  }): Promise<ExchangeClosedTrade[]>;
}