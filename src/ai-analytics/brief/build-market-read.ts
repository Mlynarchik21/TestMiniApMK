import type {
  EtfFlowBlock,
  MarketBlock,
  MarketReadBlock,
  NewsBlock,
  StrengthBlock,
} from "../types/market-brief";

function hasImportantNews(news: NewsBlock): boolean {
  return Array.isArray(news.items) && news.items.length > 0;
}

function buildMarketState(market: MarketBlock): string {
  const btc24 = Number(market.btc.change24h ?? 0);
  const eth24 = Number(market.eth.change24h ?? 0);
  const alt24 = Number(market.altMarketChange24h ?? 0);

  if (btc24 > 2 && eth24 > 2 && alt24 > 2) {
    return "Risk-on, широкий рост по рынку";
  }

  if (btc24 > 2 && alt24 < 1) {
    return "BTC-led market, рынок ведет Bitcoin";
  }

  if (eth24 > btc24 && alt24 > btc24) {
    return "Ротация в ETH и альткоины";
  }

  if (btc24 < 0 && eth24 < 0 && alt24 < 0) {
    return "Risk-off, давление по всему рынку";
  }

  return "Смешанный рынок / переходная фаза";
}

function buildMovementLeader(market: MarketBlock): string {
  const btc24 = Number(market.btc.change24h ?? -999);
  const eth24 = Number(market.eth.change24h ?? -999);
  const alt24 = Number(market.altMarketChange24h ?? -999);

  const entries = [
    { name: "BTC", value: btc24 },
    { name: "ETH", value: eth24 },
    { name: "Altcoins", value: alt24 },
  ].sort((a, b) => b.value - a.value);

  return entries[0]?.name || "N/A";
}

function buildEtfSupport(etf: EtfFlowBlock, news: NewsBlock): string {
  const btcFlow = Number(etf.bitcoinSpotEtfNetflow ?? 0);
  const ethFlow = Number(etf.ethereumSpotEtfNetflow ?? 0);
  const hasNews = hasImportantNews(news);

  const total = btcFlow + ethFlow;

  if (total > 0 && hasNews) {
    return "Да, движение поддерживается ETF-потоками и новостным фоном";
  }

  if (total > 0) {
    return "Частично да, есть поддержка со стороны ETF";
  }

  if (total < 0) {
    return "Скорее нет, ETF-потоки создают встречное давление";
  }

  if (hasNews) {
    return "Скорее новостной драйвер без явной ETF-поддержки";
  }

  return "Поддержка слабая / нейтральная";
}

function buildMainRisk(
  market: MarketBlock,
  etf: EtfFlowBlock,
  strength: StrengthBlock
): string {
  const btcFlow = Number(etf.bitcoinSpotEtfNetflow ?? 0);
  const weakCount = strength.weakerThanMarket.length;
  const alt24 = Number(market.altMarketChange24h ?? 0);

  if (btcFlow < 0) {
    return "Негативные ETF-потоки";
  }

  if (alt24 < -2) {
    return "Слабость альтрынка и риск более глубокой коррекции";
  }

  if (weakCount >= 4) {
    return "Широкая рыночная слабость под поверхностью";
  }

  return "Риск резкой волатильности на новостях";
}

function buildMainOpportunity(
  market: MarketBlock,
  etf: EtfFlowBlock,
  strength: StrengthBlock
): string {
  const btcFlow = Number(etf.bitcoinSpotEtfNetflow ?? 0);
  const ethFlow = Number(etf.ethereumSpotEtfNetflow ?? 0);
  const strongCount = strength.strongerThanMarket.length;
  const alt24 = Number(market.altMarketChange24h ?? 0);

  if (btcFlow > 0 && ethFlow > 0) {
    return "Продолжение институционального спроса через ETF";
  }

  if (alt24 > 2) {
    return "Ротация в сильные альткоины";
  }

  if (strongCount >= 4) {
    return "Лидеры рынка уже показывают относительную силу";
  }

  return "Точечные сделки в сильных секторах";
}

export function buildMarketRead(params: {
  market: MarketBlock;
  etf: EtfFlowBlock;
  strength: StrengthBlock;
  news: NewsBlock;
}): MarketReadBlock {
  const { market, etf, strength, news } = params;

  return {
    marketState: buildMarketState(market),
    movementLeader: buildMovementLeader(market),
    supportedByEtfAndNews: buildEtfSupport(etf, news),
    mainRisk: buildMainRisk(market, etf, strength),
    mainOpportunity: buildMainOpportunity(market, etf, strength),
  };
}