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
    (coin as any).priceChange24h ??
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
        `${fmt((s as any).sector || (s as any).name)} (${formatPct(
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
      const impact = n.whyItMatters ?? n.impact ?? n.whyImportant ?? "N/A";
      return `- ${fmt(title)} — ${fmt(summary)} — ${fmt(impact)}`;
    })
    .join("\n");
}

function mapEvents(events: EventItem[] | null | undefined): string {
  if (!events?.length) return "N/A";

  return events
    .map((e: any) => {
      const title = e.title ?? "N/A";
      const date = e.date ?? e.when ?? "N/A";
      const impact = e.whyItMatters ?? e.impact ?? e.whyImportant ?? "N/A";
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
  return e?.thisWeek ?? e?.week ?? e?.weekEvents ?? [];
}

function getAltChange24h(brief: MarketBrief): number | null {
  const market: any = brief.market;
  return market?.altMarketChange24h ?? market?.alt?.change24h ?? null;
}

function getAltChange7d(brief: MarketBrief): number | null {
  const market: any = brief.market;
  return market?.altMarketChange7d ?? market?.alt?.change7d ?? null;
}

function getStrongCoins(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return s?.strongerThanMarket ?? s?.strongCoins ?? s?.leaders ?? [];
}

function getWeakCoins(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return s?.weakerThanMarket ?? s?.weakCoins ?? s?.laggards ?? [];
}

function getTopGainers(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return s?.topGainers ?? s?.gainers ?? [];
}

function getTopLosers(brief: MarketBrief): StrengthCoin[] {
  const s: any = brief.strength;
  return s?.topLosers ?? s?.losers ?? [];
}

function getStrongSectors(brief: MarketBrief): SectorStrength[] {
  const s: any = brief.strength;
  return s?.strongSectors ?? s?.sectorLeaders ?? [];
}

function getWeakSectors(brief: MarketBrief): SectorStrength[] {
  const s: any = brief.strength;
  return s?.weakSectors ?? s?.sectorLaggards ?? [];
}

export function buildPrompt(brief: MarketBrief): string {
  return `
Ты крипто-аналитик для Telegram-канала.
Сделай готовый короткий Telegram-пост на русском языке.
Стиль: уверенно, ясно, без воды, без эмодзи-спама, без выдуманных фактов.
Если каких-то данных нет, просто пропусти их или кратко укажи N/A.
Не пиши вступление вроде "Вот пост".
Не пиши внутренние рассуждения.
Сразу верни готовый текст поста.

Используй эти данные:

=== MARKET ===
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

=== MARKET STRENGTH ===
- strongerThanMarket=${mapCoins(getStrongCoins(brief))}
- weakerThanMarket=${mapCoins(getWeakCoins(brief))}
- topGainers=${mapCoins(getTopGainers(brief))}
- topLosers=${mapCoins(getTopLosers(brief))}
- strongSectors=${mapSectors(getStrongSectors(brief))}
- weakSectors=${mapSectors(getWeakSectors(brief))}

=== NEWS ===
${mapNews(brief.news)}

=== EVENTS ===
- today:
${mapEvents(getTodayEvents(brief))}

- tomorrow:
${mapEvents(getTomorrowEvents(brief))}

- week:
${mapEvents(getWeekEvents(brief))}

=== MARKET READ ===
- marketPhase=${fmt(brief.marketRead?.marketState)}
- leader=${fmt(brief.marketRead?.movementLeader)}
- etfSupport=${fmt(brief.marketRead?.supportedByEtfAndNews)}
- risks=${fmt(brief.marketRead?.mainRisk)}
- opportunities=${fmt(brief.marketRead?.mainOpportunity)}

Требования к итоговому посту:
1. 5-10 коротких абзацев или блоков.
2. Сначала дай общее состояние рынка.
3. Потом BTC / ETH / доминацию / общий market cap.
4. Потом кто сильнее рынка и какие сектора выглядят лучше/хуже.
5. Если есть ETF / новости / события — добавь отдельными короткими блоками.
6. В конце дай краткий вывод: риск и возможность.
7. Не выдумывай отсутствующие данные.
8. Пиши естественным русским языком для Telegram.
`;
}