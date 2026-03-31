import type { MarketBrief } from "../types/market-brief";
import { getMarketBlock } from "../data/market";
import { getEtfBlock } from "../data/etf";
import { getStrengthBlock } from "../data/strength";
import { getNewsBlock } from "../data/news";
import { getEventsBlock } from "../data/events";
import { buildMarketRead } from "./build-market-read";
import { nowIso } from "../utils/dates";

/* =========================
   VALIDATORS (ВАЖНО)
========================= */

function isValidMarket(m: any): boolean {
  return (
    m &&
    m.btc?.price !== null &&
    m.eth?.price !== null &&
    m.totalMarketCap !== null
  );
}

function isValidStrength(s: any): boolean {
  return (
    s &&
    Array.isArray(s.strongerThanMarket) &&
    Array.isArray(s.weakerThanMarket)
  );
}

function isValidNews(n: any): boolean {
  return n && Array.isArray(n.items);
}

function isValidEvents(e: any): boolean {
  return (
    e &&
    Array.isArray(e.today) &&
    Array.isArray(e.tomorrow) &&
    Array.isArray(e.thisWeek)
  );
}

function isValidEtf(e: any): boolean {
  return e && "bitcoinSpotEtfNetflow" in e;
}

/* =========================
   BUILD
========================= */

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
      : { items: [] };

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

    /* 🔥 ГЛАВНОЕ ИСПРАВЛЕНИЕ */
    quality: {
      marketOk:
        marketRes.status === "fulfilled" && isValidMarket(market),

      etfOk:
        etfRes.status === "fulfilled" && isValidEtf(etf),

      strengthOk:
        strengthRes.status === "fulfilled" && isValidStrength(strength),

      newsOk:
        newsRes.status === "fulfilled" && isValidNews(news),

      eventsOk:
        eventsRes.status === "fulfilled" && isValidEvents(events),
    },
  };
}