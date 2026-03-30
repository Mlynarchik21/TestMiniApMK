import { NextResponse } from "next/server";
import { buildMarketRead } from "../../../../src/ai-analytics/brief/build-market-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = buildMarketRead({
    market: {
      btc: {
        symbol: "BTC",
        name: "Bitcoin",
        price: 67000,
        change1h: 0.1,
        change24h: 1.2,
        change7d: -1.5,
        volume24h: 1000000000,
        marketCap: 1300000000000,
      },
      eth: {
        symbol: "ETH",
        name: "Ethereum",
        price: 2000,
        change1h: 0.2,
        change24h: 2.5,
        change7d: 0.3,
        volume24h: 500000000,
        marketCap: 250000000000,
      },
      altMarketChange24h: 1.8,
      altMarketChange7d: 0.9,
      btcDominance: 56,
      ethDominance: 10,
      totalMarketCap: 2400000000000,
      totalVolume24h: 70000000000,
    },
    etf: {
      bitcoinSpotEtfNetflow: null,
      ethereumSpotEtfNetflow: null,
      summary: null,
      tradingDate: null,
    },
    strength: {
      strongerThanMarket: [],
      weakerThanMarket: [{ symbol: "ADA" } as any, { symbol: "BCH" } as any, { symbol: "TON" } as any, { symbol: "AVAX" } as any],
      topGainers: [],
      topLosers: [],
      strongSectors: [],
      weakSectors: [],
    },
    news: {
      items: [],
    },
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}