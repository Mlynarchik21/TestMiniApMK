import type { MarketBlock, PriceSnapshot } from "../types/market-brief";
import { safeFetchJson } from "../utils/http";
import { percentChange, toNumber } from "../utils/numbers";

type CoinGeckoCoinsMarketsRow = {
  id?: string;
  symbol?: string;
  name?: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
};

type CoinGeckoGlobalResp = {
  data?: {
    total_market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    market_cap_percentage?: {
      btc?: number;
      eth?: number;
    };
    market_cap_change_percentage_24h_usd?: number;
  };
};

type Binance24hTicker = {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  volume?: string;
  quoteVolume?: string;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

function emptySnapshot(symbol: string, name: string): PriceSnapshot {
  return {
    symbol,
    name,
    price: null,
    change1h: null,
    change24h: null,
    change7d: null,
    volume24h: null,
    marketCap: null,
  };
}

function isGoodNumber(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidSnapshot(s: PriceSnapshot | null | undefined): boolean {
  return !!s && isGoodNumber(s.price);
}

function mapCoinGecko(
  row: CoinGeckoCoinsMarketsRow | undefined,
  fallbackSymbol: string,
  fallbackName: string
): PriceSnapshot {
  if (!row) return emptySnapshot(fallbackSymbol, fallbackName);

  return {
    symbol: String(row.symbol || fallbackSymbol).toUpperCase(),
    name: String(row.name || fallbackName),
    price: toNumber(row.current_price),
    change1h: toNumber(row.price_change_percentage_1h_in_currency),
    change24h: toNumber(row.price_change_percentage_24h_in_currency),
    change7d: toNumber(row.price_change_percentage_7d_in_currency),
    volume24h: toNumber(row.total_volume),
    marketCap: toNumber(row.market_cap),
  };
}

async function getBinanceSnapshot(
  symbol: "BTCUSDT" | "ETHUSDT",
  name: string
): Promise<PriceSnapshot> {
  const [ticker, klines1h, klines7d] = await Promise.all([
    safeFetchJson<Binance24hTicker>(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      undefined,
      7000
    ),
    safeFetchJson<BinanceKline[]>(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=2`,
      undefined,
      7000
    ),
    safeFetchJson<BinanceKline[]>(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=8`,
      undefined,
      7000
    ),
  ]);

  const lastPrice = toNumber(Number(ticker?.lastPrice ?? null));
  const change24h = toNumber(Number(ticker?.priceChangePercent ?? null));
  const volume24h = toNumber(Number(ticker?.quoteVolume ?? null));

  let change1h: number | null = null;
  let change7d: number | null = null;

  if (Array.isArray(klines1h) && klines1h.length >= 2) {
    const prevClose = Number(klines1h[0]?.[4] ?? null);
    const currentClose = Number(klines1h[1]?.[4] ?? null);
    if (Number.isFinite(prevClose) && Number.isFinite(currentClose) && prevClose > 0) {
      change1h = percentChange(currentClose, prevClose);
    }
  }

  if (Array.isArray(klines7d) && klines7d.length >= 8) {
    const firstClose = Number(klines7d[0]?.[4] ?? null);
    const lastClose = Number(klines7d[7]?.[4] ?? null);
    if (Number.isFinite(firstClose) && Number.isFinite(lastClose) && firstClose > 0) {
      change7d = percentChange(lastClose, firstClose);
    }
  } else if (Array.isArray(klines7d) && klines7d.length >= 2) {
    const firstClose = Number(klines7d[0]?.[4] ?? null);
    const lastClose = Number(klines7d[klines7d.length - 1]?.[4] ?? null);
    if (Number.isFinite(firstClose) && Number.isFinite(lastClose) && firstClose > 0) {
      change7d = percentChange(lastClose, firstClose);
    }
  }

  return {
    symbol: symbol.replace("USDT", ""),
    name,
    price: lastPrice,
    change1h,
    change24h,
    change7d,
    volume24h,
    marketCap: null, // Binance market cap не даёт
  };
}

function calcMarketCapFromDominance(
  totalMarketCap: number | null,
  dominance: number | null
): number | null {
  if (!isGoodNumber(totalMarketCap) || !isGoodNumber(dominance)) return null;
  return (totalMarketCap as number) * ((dominance as number) / 100);
}

function calcAltMarketChange24h(
  totalMarketCap: number | null,
  btcCap: number | null,
  ethCap: number | null,
  totalMarketChange24h: number | null,
  btcChange24h: number | null,
  ethChange24h: number | null
): number | null {
  if (
    !isGoodNumber(totalMarketCap) ||
    !isGoodNumber(btcCap) ||
    !isGoodNumber(ethCap)
  ) {
    return null;
  }

  const altCap = (totalMarketCap as number) - (btcCap as number) - (ethCap as number);
  if (altCap <= 0) return null;

  const totalPrev =
    (totalMarketCap as number) /
    (1 + Number(totalMarketChange24h ?? 0) / 100);

  const btcPrev =
    (btcCap as number) /
    (1 + Number(btcChange24h ?? 0) / 100);

  const ethPrev =
    (ethCap as number) /
    (1 + Number(ethChange24h ?? 0) / 100);

  const altPrev = totalPrev - btcPrev - ethPrev;
  return percentChange(altCap, altPrev);
}

function calcAltMarketChange7d(
  totalMarketCap: number | null,
  btcCap: number | null,
  ethCap: number | null,
  btcChange7d: number | null,
  ethChange7d: number | null
): number | null {
  if (
    !isGoodNumber(totalMarketCap) ||
    !isGoodNumber(btcCap) ||
    !isGoodNumber(ethCap)
  ) {
    return null;
  }

  const altCap = (totalMarketCap as number) - (btcCap as number) - (ethCap as number);
  if (altCap <= 0) return null;

  const btcPrev =
    (btcCap as number) /
    (1 + Number(btcChange7d ?? 0) / 100);

  const ethPrev =
    (ethCap as number) /
    (1 + Number(ethChange7d ?? 0) / 100);

  const approxTotalPrev =
    (totalMarketCap as number) /
    (1 + ((Number(btcChange7d ?? 0) + Number(ethChange7d ?? 0)) / 2 / 100));

  const altPrev = approxTotalPrev - btcPrev - ethPrev;
  return percentChange(altCap, altPrev);
}

export async function getMarketBlock(): Promise<MarketBlock> {
  const [global, coins, btcBinance, ethBinance] = await Promise.all([
    safeFetchJson<CoinGeckoGlobalResp>(
      "https://api.coingecko.com/api/v3/global",
      undefined,
      8000
    ),
    safeFetchJson<CoinGeckoCoinsMarketsRow[]>(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=1h,24h,7d",
      undefined,
      8000
    ),
    getBinanceSnapshot("BTCUSDT", "Bitcoin").catch(() => emptySnapshot("BTC", "Bitcoin")),
    getBinanceSnapshot("ETHUSDT", "Ethereum").catch(() => emptySnapshot("ETH", "Ethereum")),
  ]);

  const btcRow = coins?.find((c) => c.id === "bitcoin");
  const ethRow = coins?.find((c) => c.id === "ethereum");

  let btc = mapCoinGecko(btcRow, "BTC", "Bitcoin");
  let eth = mapCoinGecko(ethRow, "ETH", "Ethereum");

  // FALLBACK НА BINANCE
  if (!isValidSnapshot(btc)) {
    btc = {
      ...btcBinance,
      marketCap: btc.marketCap,
    };
  }

  if (!isValidSnapshot(eth)) {
    eth = {
      ...ethBinance,
      marketCap: eth.marketCap,
    };
  }

  const totalMarketCap = toNumber(global?.data?.total_market_cap?.usd);
  const totalVolume24h = toNumber(global?.data?.total_volume?.usd);
  const btcDominance = toNumber(global?.data?.market_cap_percentage?.btc);
  const ethDominance = toNumber(global?.data?.market_cap_percentage?.eth);
  const totalMarketChange24h = toNumber(global?.data?.market_cap_change_percentage_24h_usd);

  // если marketCap по BTC/ETH не пришёл из CoinGecko — считаем через dominance
  const btcMarketCap =
    btc.marketCap ?? calcMarketCapFromDominance(totalMarketCap, btcDominance);
  const ethMarketCap =
    eth.marketCap ?? calcMarketCapFromDominance(totalMarketCap, ethDominance);

  btc = { ...btc, marketCap: btcMarketCap };
  eth = { ...eth, marketCap: ethMarketCap };

  const altMarketChange24h = calcAltMarketChange24h(
    totalMarketCap,
    btc.marketCap,
    eth.marketCap,
    totalMarketChange24h,
    btc.change24h,
    eth.change24h
  );

  const altMarketChange7d = calcAltMarketChange7d(
    totalMarketCap,
    btc.marketCap,
    eth.marketCap,
    btc.change7d,
    eth.change7d
  );

  return {
    btc,
    eth,
    altMarketChange24h,
    altMarketChange7d,
    btcDominance,
    ethDominance,
    totalMarketCap,
    totalVolume24h,
  };
}