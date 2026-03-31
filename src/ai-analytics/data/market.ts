import type { MarketBlock, PriceSnapshot } from "../types/market-brief";
import { fetchJson } from "../utils/http";
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

function emptyMarketBlock(): MarketBlock {
  return {
    btc: emptySnapshot("BTC", "Bitcoin"),
    eth: emptySnapshot("ETH", "Ethereum"),
    altMarketChange24h: null,
    altMarketChange7d: null,
    btcDominance: null,
    ethDominance: null,
    totalMarketCap: null,
    totalVolume24h: null,
  };
}

function mapCoin(
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

function calcAltMarketChange24h(
  totalMarketCap: number | null,
  btcCap: number | null,
  ethCap: number | null,
  totalMarketChange24h: number | null,
  btcChange24h: number | null,
  ethChange24h: number | null
): number | null {
  if (
    !Number.isFinite(totalMarketCap ?? NaN) ||
    !Number.isFinite(btcCap ?? NaN) ||
    !Number.isFinite(ethCap ?? NaN)
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
    !Number.isFinite(totalMarketCap ?? NaN) ||
    !Number.isFinite(btcCap ?? NaN) ||
    !Number.isFinite(ethCap ?? NaN)
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
    (1 + (Number(btcChange7d ?? 0) + Number(ethChange7d ?? 0)) / 2 / 100);

  const altPrev = approxTotalPrev - btcPrev - ethPrev;
  return percentChange(altCap, altPrev);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 700): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

async function getGlobalData(): Promise<CoinGeckoGlobalResp | null> {
  try {
    return await withRetry(() =>
      fetchJson<CoinGeckoGlobalResp>("https://api.coingecko.com/api/v3/global")
    );
  } catch {
    return null;
  }
}

async function getCoinsData(): Promise<CoinGeckoCoinsMarketsRow[]> {
  try {
    const data = await withRetry(() =>
      fetchJson<CoinGeckoCoinsMarketsRow[]>(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=1h,24h,7d"
      )
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getMarketBlock(): Promise<MarketBlock> {
  const [global, coins] = await Promise.all([getGlobalData(), getCoinsData()]);

  const btcRow = coins.find((c) => c.id === "bitcoin");
  const ethRow = coins.find((c) => c.id === "ethereum");

  const btc = mapCoin(btcRow, "BTC", "Bitcoin");
  const eth = mapCoin(ethRow, "ETH", "Ethereum");

  const totalMarketCap = toNumber(global?.data?.total_market_cap?.usd);
  const totalVolume24h = toNumber(global?.data?.total_volume?.usd);
  const btcDominance = toNumber(global?.data?.market_cap_percentage?.btc);
  const ethDominance = toNumber(global?.data?.market_cap_percentage?.eth);
  const totalMarketChange24h = toNumber(
    global?.data?.market_cap_change_percentage_24h_usd
  );

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

  const result: MarketBlock = {
    btc,
    eth,
    altMarketChange24h,
    altMarketChange7d,
    btcDominance,
    ethDominance,
    totalMarketCap,
    totalVolume24h,
  };

  const hasAnyMarketData =
    result.btc.price != null ||
    result.eth.price != null ||
    result.totalMarketCap != null ||
    result.totalVolume24h != null;

  return hasAnyMarketData ? result : emptyMarketBlock();
}