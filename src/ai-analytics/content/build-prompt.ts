import type { EventItem, MarketBrief, NewsItem, StrengthCoin, SectorStrength } from "../types/market-brief";
import { formatBillions, formatPct, formatTrillions, formatUsd } from "../utils/numbers";

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "N/A";
  return String(v);
}

function coinLine(label: string, coin: {
  price: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  volume24h: number | null;
  marketCap: number | null;
}) {
  return [
    `${label}:`,
    `price=${formatUsd(coin.price)}`,
    `1h=${formatPct(coin.change1h)}`,
    `24h=${formatPct(coin.change24h)}`,
    `7d=${formatPct(coin.change7d)}`,
    `volume24h=${formatBillions(coin.volume24h)}`,
    `marketCap=${formatBillions(coin.marketCap)}`,
  ].join(" | ");
}

function coinsList(title: string, items: StrengthCoin[]) {
  if (!items.length) return `${title}: N/A`;

  return [
    `${title}:`,
    ...items.map(
      (c) =>
        `- ${c.symbol} | 24h=${formatPct(c.priceChange24h)} | 7d=${formatPct(
          c.priceChange7d
        )} | vol=${formatBillions(c.volume24h)} | mcap=${formatBillions(c.marketCap)}`
    ),
  ].join("\n");
}

function sectorsList(title: string, items: SectorStrength[]) {
  if (!items.length) return `${title}: N/A`;

  return [
    `${title}:`,
    ...items.map(
      (s) => `- ${s.sector} | 24h=${formatPct(s.change24h)} | 7d=${formatPct(s.change7d)}`
    ),
  ].join("\n");
}

function newsList(items: NewsItem[]) {
  if (!items.length) return "NEWS: N/A";

  return [
    "NEWS:",
    ...items.map(
      (n, i) =>
        `${i + 1}. ${n.title} | what=${n.summary} | why=${n.whyItMatters} | source=${fmt(
          n.source
        )} | category=${fmt(n.category)} | publishedAt=${fmt(n.publishedAt)}`
    ),
  ].join("\n");
}

function eventsList(title: string, items: EventItem[]) {
  if (!items.length) return `${title}: N/A`;

  return [
    `${title}:`,
    ...items.map(
      (e, i) =>
        `${i + 1}. ${e.title} | when=${e.when} | why=${e.whyItMatters} | category=${fmt(
          e.category
        )} | source=${fmt(e.source)}`
    ),
  ].join("\n");
}

export function buildPrompt(brief: MarketBrief): string {
  return `
Ты — профессиональный крипто-аналитик для Telegram-канала.

Твоя задача:
на основе данных ниже создать КОРОТКИЙ, СИЛЬНЫЙ, ЧИСТЫЙ Telegram-пост на русском языке.

ВАЖНО:
- Не выдумывай факты
- Не добавляй ничего, чего нет в данных
- Если данных нет — просто не акцентируй на этом внимание
- Стиль: уверенный, профессиональный, медийный
- Без воды
- Без канцелярщины
- Без "возможно", "вероятно" каждые 2 слова
- Пиши так, как будто это пост в сильный крипто-канал
- Можно использовать эмодзи, но умеренно
- Формат должен быть удобен для публикации в Telegram
- Сделай структуру читаемой
- В конце дай короткий вывод по рынку

СТРУКТУРА ПОСТА:
1. Короткий headline
2. Что происходит на рынке сейчас
3. ETF / потоки
4. Кто сильный / кто слабый
5. Важные новости
6. Что важно дальше
7. Финальный вывод

ДАННЫЕ:

=== MARKET ===
${coinLine("BTC", brief.market.btc)}
${coinLine("ETH", brief.market.eth)}

ALT MARKET:
- altMarket24h=${formatPct(brief.market.altMarketChange24h)}
- altMarket7d=${formatPct(brief.market.altMarketChange7d)}
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
${coinsList("STRONGER THAN MARKET", brief.strength.strongerThanMarket)}

${coinsList("WEAKER THAN MARKET", brief.strength.weakerThanMarket)}

${coinsList("TOP GAINERS", brief.strength.topGainers)}

${coinsList("TOP LOSERS", brief.strength.topLosers)}

${sectorsList("STRONG SECTORS", brief.strength.strongSectors)}

${sectorsList("WEAK SECTORS", brief.strength.weakSectors)}

=== NEWS ===
${newsList(brief.news.items)}

=== EVENTS ===
${eventsList("TODAY", brief.events.today)}

${eventsList("TOMORROW", brief.events.tomorrow)}

${eventsList("THIS WEEK", brief.events.thisWeek)}

=== MARKET READ ===
- marketState=${fmt(brief.marketRead.marketState)}
- movementLeader=${fmt(brief.marketRead.movementLeader)}
- supportedByEtfAndNews=${fmt(brief.marketRead.supportedByEtfAndNews)}
- mainRisk=${fmt(brief.marketRead.mainRisk)}
- mainOpportunity=${fmt(brief.marketRead.mainOpportunity)}

Теперь верни ТОЛЬКО готовый Telegram-пост.
Без JSON.
Без пояснений.
Без markdown fences.
`.trim();
}