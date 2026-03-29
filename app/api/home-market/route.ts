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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round(n: number, digits = 2) {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
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

function formatMarketCapTrillions(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return (n / 1_000_000_000_000).toFixed(2);
}

function calcInternalAltseason(args: {
  btcDominance: number;
  ethDominance: number;
  altDominance: number;
  marketCapChange24h: number;
  fearGreedValue: number;
}) {
  const btcScore = clamp((70 - args.btcDominance) * 2.2, 0, 100);
  const ethScore = clamp(args.ethDominance * 3.2, 0, 100);
  const altScore = clamp(args.altDominance * 3.0, 0, 100);
  const momentumScore = clamp(50 + args.marketCapChange24h * 10, 0, 100);
  const sentimentScore = clamp(args.fearGreedValue, 0, 100);

  return Math.round(
    clamp(
      btcScore * 0.28 +
        ethScore * 0.16 +
        altScore * 0.26 +
        momentumScore * 0.18 +
        sentimentScore * 0.12,
      0,
      100
    )
  );
}

function calcLongShortPercents(ratio: number | null) {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return {
      longPercent: null,
      shortPercent: null,
    };
  }

  const longPercent = round((ratio / (1 + ratio)) * 100, 1);
  const shortPercent = round(100 - longPercent, 1);

  return {
    longPercent,
    shortPercent,
  };
}

function calcSpotPerpShares(spotQuoteVolume: number, perpQuoteVolume: number) {
  const total = spotQuoteVolume + perpQuoteVolume;

  if (!Number.isFinite(total) || total <= 0) {
    return {
      spotShare: null,
      perpShare: null,
    };
  }

  const spotShare = round((spotQuoteVolume / total) * 100, 1);
  const perpShare = round(100 - spotShare, 1);

  return {
    spotShare,
    perpShare,
  };
}

function normalizeTimestamp(raw: unknown) {
  if (raw == null) return null;

  const s = String(raw).trim();
  if (!s) return null;

  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 0) {
    if (s.length >= 13) {
      const d = new Date(asNum);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }

    const d = new Date(asNum * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

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
  const btcDominance = round(toNum(d?.market_cap_percentage?.btc), 1);
  const ethDominance = round(toNum(d?.market_cap_percentage?.eth), 1);
  const altDominance = round(
    clamp(100 - btcDominance - ethDominance, 0, 100),
    1
  );

  return {
    totalMarketCapUsd,
    marketCapChange24h,
    btcDominance,
    ethDominance,
    altDominance,
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
    value: clamp(toNum(row?.value), 0, 100),
    classification: shortClassification(String(row?.value_classification || "—")),
    timestamp: normalizeTimestamp(row?.timestamp),
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

async function fetchBinanceSpot24h() {
  const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Binance spot 24h error: ${res.status} ${text}`);
  }

  return (await res.json()) as AnyJson;
}

async function fetchBinancePerp24h() {
  const res = await fetch(
    "https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT",
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Binance perp 24h error: ${res.status} ${text}`);
  }

  return (await res.json()) as AnyJson;
}

async function fetchBinanceLongShortRatio() {
  const res = await fetch(
    "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1",
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Binance long/short error: ${res.status} ${text}`);
  }

  const j = (await res.json()) as AnyJson;
  const row = Array.isArray(j) ? j[0] ?? null : null;

  return {
    longShortRatio:
      row != null ? toNum(row?.longShortRatio ?? row?.longAccount ?? 0) : 0,
    timestamp: normalizeTimestamp(row?.timestamp),
  };
}

export async function GET() {
  try {
    const [globalData, fearGreed, externalAltseason, spot24h, perp24h, longShort] =
      await Promise.all([
        fetchCoinGeckoGlobal(),
        fetchFearGreed(),
        fetchAltseason(),
        fetchBinanceSpot24h(),
        fetchBinancePerp24h(),
        fetchBinanceLongShortRatio(),
      ]);

    const internalAltseason = calcInternalAltseason({
      btcDominance: globalData.btcDominance,
      ethDominance: globalData.ethDominance,
      altDominance: globalData.altDominance,
      marketCapChange24h: globalData.marketCapChange24h,
      fearGreedValue: fearGreed.value,
    });

    const altseasonValue =
      externalAltseason.value != null ? externalAltseason.value : internalAltseason;

    const altseasonSource =
      externalAltseason.value != null ? externalAltseason.source : "internal";

    const spotQuoteVolume = toNum(spot24h?.quoteVolume);
    const perpQuoteVolume = toNum(perp24h?.quoteVolume);
    const { spotShare, perpShare } = calcSpotPerpShares(
      spotQuoteVolume,
      perpQuoteVolume
    );

    const btcLongShortRatio =
      longShort.longShortRatio > 0 ? round(longShort.longShortRatio, 3) : null;

    const { longPercent, shortPercent } = calcLongShortPercents(
      btcLongShortRatio
    );

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
        value: altseasonValue,
        source: altseasonSource,
      },
      positioning: {
        spotShare,
        perpShare,
        btcLongShortRatio,
        longPercent,
        shortPercent,
        source: "binance-btcusdt",
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