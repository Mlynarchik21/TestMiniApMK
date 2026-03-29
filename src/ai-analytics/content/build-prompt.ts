import type {
  EventItem,
  MarketBrief,
  NewsItem,
  SectorStrength,
  StrengthCoin,
} from "../types/market-brief";

import {
  formatBillions,
  formatMillions,
  formatPct,
  formatTrillions,
  formatUsd,
} from "../utils/numbers";

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "N/A";
  return String(v);
}

function getCoinChange(coin: StrengthCoin): number | null {
  const raw = (coin as any).change24h ?? (coin as any).change ?? (coin as any).performance24h ?? null;
  return typeof raw === "number" ? raw : null;
}

function getSectorChange(sector: SectorStrength): number | null {
  const raw =
    (sector as any).change24h ?? (sector as any).change ?? (sector as any).performance24h ?? null;
  return typeof raw === "number" ? raw : null;
}

function mapCoins(coins: StrengthCoin[]): string {
  if (!coins?.length) return "N/A";

  return coins
    .map((c) => `${fmt((c as any).symbol || (c as any).name)} (${formatPct(getCoinChange(c))})`)
    .join(", ");
}

function mapSectors(sectors: SectorStrength[]): string {
  if (!sectors?.length) return "N/A";

  return sectors
    .map((s) => `${fmt((s as any).name || (s as any).sector)} (${formatPct(getSectorChange(s))})`)
    .join(", ");
}

function mapNews(news: NewsItem[]): string {
  if (!news?.length) return "N/A";

  return news
    .map((n) => {
      const title = (n as any).title ?? "N/A";
      const summary = (n as any).summary ?? (n as any).whatHappened ?? "N/A";
      const impact = (n as any).impact ?? (n as any).whyImportant ?? "N/A";
      return `- ${fmt(title)} — ${fmt(summary)} — ${fmt(impact)}`;
    })
    .join("\n");
}

function mapEvents(events: EventItem[]): string {
  if (!events?.length) return "N/A";

  return events
    .map((e) => {
      const title = (e as any).title ?? "N/A";
      const date = (e as any).date ?? (e as any).when ?? "N/A";
      const impact = (e as any).impact ?? (e as any).whyImportant ?? "N/A";
      return `- ${fmt(title)} — ${fmt(date)} — ${fmt(impact)}`;
    })
    .join("\n");
}

export function buildPrompt(brief: MarketBrief): string {
  return `
Мне нужны только АКТУАЛЬНЫЕ и ПОЛЕЗНЫЕ данные для подготовки Telegram-поста.

Верни строго следующие данные:

=== РЫНОК ===
- btcPrice=${formatUsd(brief.market.btc.price)}
- btcChange1h=${formatPct(brief.market.btc.change1h)}
- btcChange24h=${formatPct(brief.market.btc.change24h)}
- btcChange7d=${formatPct(brief.market.btc.change7d)}
- btcVolume24h=${formatBillions(brief.market.btc.volume24h)}
- btcMarketCap=${formatTrillions(brief.market.btc.marketCap)}

- ethPrice=${formatUsd(brief.market.eth.price)}
- ethChange1h=${formatPct(brief.market.eth.change1h)}
- ethChange24h=${formatPct(brief.market.eth.change24h)}
- ethChange7d=${formatPct(brief.market.eth.change7d)}
- ethVolume24h=${formatBillions(brief.market.eth.volume24h)}
- ethMarketCap=${formatTrillions(brief.market.eth.marketCap)}

- altChange24h=${formatPct(brief.market.alt.change24h)}
- altChange7d=${formatPct(brief.market.alt.change7d)}

- btcDominance=${formatPct(brief.market.btcDominance)}
- ethDominance=${formatPct(brief.market.ethDominance)}

- totalMarketCap=${formatTrillions(brief.market.totalMarketCap)}
- totalVolume24h=${formatBillions(brief.market.totalVolume24h)}

=== ETF ===
- bitcoinSpotEtfNetflow=${formatMillions(brief.etf.bitcoinSpotEtfNetflow)}
- ethereumSpotEtfNetflow=${formatMillions(brief.etf.ethereumSpotEtfNetflow)}
- etfSummary=${fmt(brief.etf.summary)}
- tradingDate=${fmt(brief.etf.tradingDate)}

=== РЫНОЧНАЯ СИЛА ===
- strongerThanMarket=${mapCoins(brief.strength.strongCoins)}
- weakerThanMarket=${mapCoins(brief.strength.weakCoins)}
- topGainers=${mapCoins(brief.strength.gainers)}
- topLosers=${mapCoins(brief.strength.losers)}
- strongSectors=${mapSectors(brief.strength.strongSectors)}
- weakSectors=${mapSectors(brief.strength.weakSectors)}

=== НОВОСТИ ===
${mapNews(brief.news)}

=== СОБЫТИЯ ===
- today:
${mapEvents(brief.events.today)}

- tomorrow:
${mapEvents(brief.events.tomorrow)}

- week:
${mapEvents(brief.events.week)}

=== КРАТКИЙ MARKET READ ===
- marketPhase=${fmt(brief.marketRead.phase)}
- leader=${fmt(brief.marketRead.leader)}
- etfSupport=${fmt(brief.marketRead.etfSupport)}
- risks=${fmt(brief.marketRead.risks)}
- opportunities=${fmt(brief.marketRead.opportunities)}

ВАЖНО:
- Не выдумывай данные
- Если данных нет — пиши N/A
- Не пиши длинные объяснения
- Не пиши внутренние рассуждения
- Ответ должен быть удобен для дальнейшей передачи в другой ИИ
`;
}