import type {
  StrengthBlock,
  StrengthCoin,
  SectorStrength,
} from "../types/market-brief";
import {
  MAX_GAINERS,
  MAX_LOSERS,
  MAX_SECTORS,
  MAX_STRENGTH_COINS,
  MIN_LIQUID_MARKET_CAP,
  MIN_LIQUID_VOLUME_24H,
  SECTOR_KEYWORDS,
  SIGNIFICANT_COINS,
} from "../constants/filters";
import { fetchJson } from "../utils/http";
import { toNumber } from "../utils/numbers";

type CoinRow = {
  id?: string;
  symbol?: string;
  name?: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  categories?: string[];
};

type CategoryRow = {
  id?: string;
  name?: string;
  market_cap_change_24h?: number;
  content?: string;
};

function mapCoin(row: CoinRow): StrengthCoin {
  return {
    symbol: String(row.symbol || "").toUpperCase(),
    name: String(row.name || ""),
    priceChange24h: toNumber(row.price_change_percentage_24h_in_currency),
    priceChange7d: toNumber(row.price_change_percentage_7d_in_currency),
    volume24h: toNumber(row.total_volume),
    marketCap: toNumber(row.market_cap),
  };
}

function isLiquid(row: CoinRow) {
  return (
    Number(row.market_cap || 0) >= MIN_LIQUID_MARKET_CAP &&
    Number(row.total_volume || 0) >= MIN_LIQUID_VOLUME_24H
  );
}

function isSignificant(row: CoinRow) {
  return SIGNIFICANT_COINS.includes(String(row.symbol || "").toUpperCase());
}

function by24hDesc(a: CoinRow, b: CoinRow) {
  return Number(b.price_change_percentage_24h_in_currency || -999) -
    Number(a.price_change_percentage_24h_in_currency || -999);
}

function by24hAsc(a: CoinRow, b: CoinRow) {
  return Number(a.price_change_percentage_24h_in_currency || 999) -
    Number(b.price_change_percentage_24h_in_currency || 999);
}

function buildSectorStrength(categories: CategoryRow[]): {
  strongSectors: SectorStrength[];
  weakSectors: SectorStrength[];
} {
  const sectorMap: SectorStrength[] = [];

  for (const [sectorName, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    const match = categories.find((c) => {
      const hay = `${c.name || ""} ${c.content || ""}`.toLowerCase();
      return keywords.some((k) => hay.includes(k.toLowerCase()));
    });

    sectorMap.push({
      sector: sectorName,
      change24h: toNumber(match?.market_cap_change_24h),
      change7d: null,
    });
  }

  const valid = sectorMap.filter((s) => Number.isFinite(s.change24h ?? NaN));

  const strongSectors = [...valid]
    .sort((a, b) => Number(b.change24h || -999) - Number(a.change24h || -999))
    .slice(0, MAX_SECTORS);

  const weakSectors = [...valid]
    .sort((a, b) => Number(a.change24h || 999) - Number(b.change24h || 999))
    .slice(0, MAX_SECTORS);

  return {
    strongSectors,
    weakSectors,
  };
}

export async function getStrengthBlock(): Promise<StrengthBlock> {
  try {
    const [coins, categories] = await Promise.all([
      fetchJson<CoinRow[]>(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d"
      ),
      fetchJson<CategoryRow[]>(
        "https://api.coingecko.com/api/v3/coins/categories?order=market_cap_desc"
      ).catch(() => []),
    ]);

    const liquid = coins.filter(isLiquid);

    const significant = liquid.filter(isSignificant);

    const strongerThanMarket = significant
      .filter((c) => Number(c.price_change_percentage_24h_in_currency || -999) > 0)
      .sort(by24hDesc)
      .slice(0, MAX_STRENGTH_COINS)
      .map(mapCoin);

    const weakerThanMarket = significant
      .filter((c) => Number(c.price_change_percentage_24h_in_currency || 999) < 0)
      .sort(by24hAsc)
      .slice(0, MAX_STRENGTH_COINS)
      .map(mapCoin);

    const topGainers = liquid
      .filter((c) => Number(c.price_change_percentage_24h_in_currency || -999) > 0)
      .sort(by24hDesc)
      .slice(0, MAX_GAINERS)
      .map(mapCoin);

    const topLosers = liquid
      .filter((c) => Number(c.price_change_percentage_24h_in_currency || 999) < 0)
      .sort(by24hAsc)
      .slice(0, MAX_LOSERS)
      .map(mapCoin);

    const { strongSectors, weakSectors } = buildSectorStrength(categories);

    return {
      strongerThanMarket,
      weakerThanMarket,
      topGainers,
      topLosers,
      strongSectors,
      weakSectors,
    };
  } catch {
    return {
      strongerThanMarket: [],
      weakerThanMarket: [],
      topGainers: [],
      topLosers: [],
      strongSectors: [],
      weakSectors: [],
    };
  }
}