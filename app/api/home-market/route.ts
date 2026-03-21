import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnyJson = any;

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init?.headers || {}),
    },
  });
}

function toNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function shortClassification(v: string) {
  const s = String(v || "").toLowerCase();
  if (s.includes("extreme fear")) return "Extreme Fear";
  if (s.includes("fear")) return "Fear";
  if (s.includes("neutral")) return "Neutral";
  if (s.includes("extreme greed")) return "Extreme Greed";
  if (s.includes("greed")) return "Greed";
  return v || "—";
}

function parseAltseasonFromHtml(html: string): number | null {
  if (!html) return null;

  const patterns = [
    /Altcoin Season\s*\((\d{1,3})\)/i,
    /Altcoin Season Index[\s\S]{0,400}?(\d{1,3})\s*<\/?/i,
    /"altseason"\D{0,40}(\d{1,3})/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
  }

  return null;
}

async function fetchCoinGeckoGlobal() {
  const apiKey = process.env.COINGECKO_API_KEY?.trim();

  const res = await fetch("https://api.coingecko.com/api/v3/global", {
    method: "GET",
    headers: {
      ...(apiKey ? { "x-cg-demo-api-key": apiKey } : {}),
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CoinGecko global error: ${res.status} ${text}`);
  }

  const j = (await res.json()) as AnyJson;
  const d = j?.data ?? {};

  const totalMarketCapUsd = toNum(d?.total_market_cap?.usd);
  const marketCapChange24h = toNum(d?.market_cap_change_percentage_24h_usd);
  const btcDominance = toNum(d?.market_cap_percentage?.btc);
  const ethDominance = toNum(d?.market_cap_percentage?.eth);

  return {
    totalMarketCapUsd,
    marketCapChange24h,
    btcDominance,
    ethDominance,
    altDominance: Math.max(0, 100 - btcDominance - ethDominance),
    activeCryptocurrencies: toNum(d?.active_cryptocurrencies),
    markets: toNum(d?.markets),
    totalVolumeUsd: toNum(d?.total_volume?.usd),
  };
}

async function fetchFearGreed() {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FearGreed error: ${res.status} ${text}`);
  }

  const j = (await res.json()) as AnyJson;
  const row = Array.isArray(j?.data) ? j.data[0] : null;

  return {
    value: toNum(row?.value),
    classification: shortClassification(String(row?.value_classification || "—")),
    timestamp: row?.timestamp ?? null,
    timeUntilUpdate: toNum(row?.time_until_update, 0),
  };
}

async function fetchAltseason() {
  const urls = [
    "https://www.blockchaincenter.net/en/altcoin-season-index/",
    "https://www.blockchaincenter.net/altcoin-season-index/",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "user-agent": "Mozilla/5.0",
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (!res.ok) continue;

      const html = await res.text();
      const value = parseAltseasonFromHtml(html);

      if (value != null) {
        return {
          value,
          source: url,
        };
      }
    } catch {}
  }

  return {
    value: null,
    source: null,
  };
}

function formatMarketCapTrillions(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return (n / 1_000_000_000_000).toFixed(2);
}

export async function GET() {
  try {
    const [globalData, fearGreed, altseason] = await Promise.all([
      fetchCoinGeckoGlobal(),
      fetchFearGreed(),
      fetchAltseason(),
    ]);

    return json({
      ok: true,
      market: {
        totalMarketCapUsd: globalData.totalMarketCapUsd,
        totalMarketCapT: formatMarketCapTrillions(globalData.totalMarketCapUsd),
        marketCapChange24h: globalData.marketCapChange24h,
        btcDominance: globalData.btcDominance,
        ethDominance: globalData.ethDominance,
        altDominance: globalData.altDominance,
        activeCryptocurrencies: globalData.activeCryptocurrencies,
        markets: globalData.markets,
        totalVolumeUsd: globalData.totalVolumeUsd,
      },
      fearGreed: {
        value: fearGreed.value,
        classification: fearGreed.classification,
        timestamp: fearGreed.timestamp,
        timeUntilUpdate: fearGreed.timeUntilUpdate,
      },
      altseason: {
        value: altseason.value,
        source: altseason.source,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "HOME_MARKET_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}