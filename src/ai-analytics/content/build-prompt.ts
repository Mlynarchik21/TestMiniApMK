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
  const raw =
    (coin as any).change24h ??
    (coin as any).change ??
    (coin as any).performance24h ??
    (coin as any).pct24h ??
    null;

  return typeof raw === "number" ? raw : null;
}

function getSectorChange(sector: SectorStrength): number | null {
  const raw =
    (sector as any).change24h ??
    (sector as any).change ??
    (sector as any).performance24h ??
    (sector as any).pct24h ??
    null;

  return typeof raw === "number" ? raw : null;
}

function mapCoins(coins: StrengthCoin[] | null | undefined): string {
  if (!coins?.length) return "N/A";

  return coins
    .map(
      (c) =>
        `${fmt((c as any).symbol || (c as any).name)} (${formatPct(
          getCoinChange(c)
        )})`
    )
    .join(", ");
}

function mapSectors(sectors: SectorStrength[] | null | undefined): string {
  if (!sectors?.length) return "N/A";

  return sectors
    .map(
      (s) =>
        `${fmt((s as any).name || (s as any).sector)} (${formatPct(
          getSectorChange(s)
        )})`
    )
    .join(", ");
}

function extractNewsArray(input: any): NewsItem[] {
  if (!input) return [];

  if (Array.isArray(input)) return input;

  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.news)) return input.news;
  if (Array.isArray(input.list)) return input.list;

  return [];
}

function mapNews(newsInput: any): string {
  const news = extractNewsArray(newsInput);

  if (!news.length) return "N/A";

  return news
    .map((n: any) => {
      const title = n.title ?? "N/A";
      const summary = n.summary ?? n.whatHappened ?? "N/A";
      const impact = n.impact ?? n.whyImportant ?? "N/A";

      return `- ${fmt(title)} — ${fmt(summary)} — ${fmt(impact)}`;
    })
    .join("\n");
}

function mapEvents(events: EventItem[] | null | undefined): string {
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

function getTodayEvents(brief: MarketBrief): EventItem[] {
  const e: any = brief.events;
  return e?.today ?? e?.todayEvents ?? [];
}

function getTomorrowEvents(brief: MarketBrief): EventItem[] {
  const e: any = brief.events;
  return e?.tomorrow ?? e?.tomorrowEvents ?? [];
}

function getWeekEvents(brief: MarketBrief): EventItem[] {
  const e: any = brief.events;
  return e?.week ?? e?.weekEvents ?? e?.thisWeek ?? [];
}

function getAltChange24h(brief: MarketBrief): number | null {
  const market: any = brief.market;
  return (
    market?.alt?.change24h ??
    market?.altChange24h ??
    market?.alts24h ??
    null
  );
}

function getAltChange7d(brief: MarketBrief): number | null {
  const market: any = brief.market;
  return (
    market?.alt?.change7d ??
    market?.altChange7d ??
    market?.alts7d ??
    null
  );
}

function getStrongCoins(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return (
    s?.strongCoins ??
    s?.strongerThanMarket ??
    s?.leaders ??
    s?.outperformers ??
    []
  );
}

function getWeakCoins(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return (
    s?.weakCoins ??
    s?.weakerThanMarket ??
    s?.laggards ??
    s?.underperformers ??
    []
  );
}

function getTopGainers(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return s?.gainers ?? s?.topGainers ?? [];
}

function getTopLosers(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return s?.losers ?? s?.topLosers ?? [];
}

function getStrongSectors(brief: MarketBrief): SectorStrength[] {
  const s: any = brief.strength;
  return (
    s?.strongSectors ??
    s?.sectorLeaders ??
    s?.bestSectors ??
    []
  );
}

function getWeakSectors(brief: MarketBrief): SectorStrength[] {
  const s: any = brief.strength;
  return (
    s?.weakSectors ??
    s?.sectorLaggards ??
    s?.worstSectors ??
    []
  );
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

- altChange24h=${formatPct(getAltChange24h(brief))}
- altChange7d=${formatPct(getAltChange7d(brief))}

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
- strongerThanMarket=${mapCoins(getStrongCoins(brief))}
- weakerThanMarket=${mapCoins(getWeakCoins(brief))}
- topGainers=${mapCoins(getTopGainers(brief))}
- topLosers=${mapCoins(getTopLosers(brief))}
- strongSectors=${mapSectors(getStrongSectors(brief))}
- weakSectors=${mapSectors(getWeakSectors(brief))}

=== НОВОСТИ ===
${mapNews(brief.news)}

=== СОБЫТИЯ ===
- today:
${mapEvents(getTodayEvents(brief))}

- tomorrow:
${mapEvents(getTomorrowEvents(brief))}

- week:
${mapEvents(getWeekEvents(brief))}

=== КРАТКИЙ MARKET READ ===
- marketPhase=${fmt(brief.marketRead?.marketState)}
- leader=${fmt(brief.marketRead?.movementLeader)}
- etfSupport=${fmt(brief.marketRead?.supportedByEtfAndNews)}
- risks=${fmt(brief.marketRead?.mainRisk)}
- opportunities=${fmt(brief.marketRead?.mainOpportunity)}

ВАЖНО:
- Не выдумывай данные
- Если данных нет — пиши N/A
- Не пиши длинные объяснения
- Не пиши внутренние рассуждения
- Ответ должен быть удобен для дальнейшей передачи в другой ИИ
`;
}