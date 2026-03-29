import type { MarketBrief } from "../types/market-brief";
import { getMarketBlock } from "../data/market";
import { getEtfBlock } from "../data/etf";
import { getStrengthBlock } from "../data/strength";
import { getNewsBlock } from "../data/news";
import { getEventsBlock } from "../data/events";
import { buildMarketRead } from "./build-market-read";
import { nowIso } from "../utils/dates";

export async function buildBrief(): Promise<MarketBrief> {
  const [marketRes, etfRes, strengthRes, newsRes, eventsRes] =
    await Promise.allSettled([
      getMarketBlock(),
      getEtfBlock(),
      getStrengthBlock(),
      getNewsBlock(),
      getEventsBlock(),
    ]);

  const market =
    marketRes.status === "fulfilled"
      ? marketRes.value
      : {
          btc: {
            symbol: "BTC",
            name: "Bitcoin",
            price: null,
            change1h: null,
            change24h: null,
            change7d: null,
            volume24h: null,
            marketCap: null,
          },
          eth: {
            symbol: "ETH",
            name: "Ethereum",
            price: null,
            change1h: null,
            change24h: null,
            change7d: null,
            volume24h: null,
            marketCap: null,
          },
          altMarketChange24h: null,
          altMarketChange7d: null,
          btcDominance: null,
          ethDominance: null,
          totalMarketCap: null,
          totalVolume24h: null,
        };

  const etf =
    etfRes.status === "fulfilled"
      ? etfRes.value
      : {
          bitcoinSpotEtfNetflow: null,
          ethereumSpotEtfNetflow: null,
          summary: null,
          tradingDate: null,
        };

  const strength =
    strengthRes.status === "fulfilled"
      ? strengthRes.value
      : {
          strongerThanMarket: [],
          weakerThanMarket: [],
          topGainers: [],
          topLosers: [],
          strongSectors: [],
          weakSectors: [],
        };

  const news =
    newsRes.status === "fulfilled"
      ? newsRes.value
      : {
          items: [],
        };

  const events =
    eventsRes.status === "fulfilled"
      ? eventsRes.value
      : {
          today: [],
          tomorrow: [],
          thisWeek: [],
        };

  const marketRead = buildMarketRead({
    market,
    etf,
    strength,
    news,
  });

  return {
    generatedAt: nowIso(),
    market,
    etf,
    strength,
    news,
    events,
    marketRead,
    quality: {
      marketOk: marketRes.status === "fulfilled",
      etfOk: etfRes.status === "fulfilled",
      strengthOk: strengthRes.status === "fulfilled",
      newsOk: newsRes.status === "fulfilled",
      eventsOk: eventsRes.status === "fulfilled",
    },
  };
}