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
    return "Risk-on, \u0448\u0438\u0440\u043e\u043a\u0438\u0439 \u0440\u043e\u0441\u0442 \u043f\u043e \u0440\u044b\u043d\u043a\u0443";
  }

  if (btc24 > 2 && alt24 < 1) {
    return "BTC-led market, \u0440\u044b\u043d\u043e\u043a \u0432\u0435\u0434\u0435\u0442 Bitcoin";
  }

  if (eth24 > btc24 && alt24 > btc24) {
    return "\u0420\u043e\u0442\u0430\u0446\u0438\u044f \u0432 ETH \u0438 \u0430\u043b\u044c\u0442\u043a\u043e\u0438\u043d\u044b";
  }

  if (btc24 < 0 && eth24 < 0 && alt24 < 0) {
    return "Risk-off, \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u043e \u0432\u0441\u0435\u043c\u0443 \u0440\u044b\u043d\u043a\u0443";
  }

  return "\u0421\u043c\u0435\u0448\u0430\u043d\u043d\u044b\u0439 \u0440\u044b\u043d\u043e\u043a / \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u043d\u0430\u044f \u0444\u0430\u0437\u0430";
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
    return "\u0414\u0430, \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f ETF-\u043f\u043e\u0442\u043e\u043a\u0430\u043c\u0438 \u0438 \u043d\u043e\u0432\u043e\u0441\u0442\u043d\u044b\u043c \u0444\u043e\u043d\u043e\u043c";
  }

  if (total > 0) {
    return "\u0427\u0430\u0441\u0442\u0438\u0447\u043d\u043e \u0434\u0430, \u0435\u0441\u0442\u044c \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u0441\u043e \u0441\u0442\u043e\u0440\u043e\u043d\u044b ETF";
  }

  if (total < 0) {
    return "\u0421\u043a\u043e\u0440\u0435\u0435 \u043d\u0435\u0442, ETF-\u043f\u043e\u0442\u043e\u043a\u0438 \u0441\u043e\u0437\u0434\u0430\u044e\u0442 \u0432\u0441\u0442\u0440\u0435\u0447\u043d\u043e\u0435 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435";
  }

  if (hasNews) {
    return "\u0421\u043a\u043e\u0440\u0435\u0435 \u043d\u043e\u0432\u043e\u0441\u0442\u043d\u043e\u0439 \u0434\u0440\u0430\u0439\u0432\u0435\u0440 \u0431\u0435\u0437 \u044f\u0432\u043d\u043e\u0439 ETF-\u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438";
  }

  return "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u0441\u043b\u0430\u0431\u0430\u044f / \u043d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u0430\u044f";
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
    return "\u041d\u0435\u0433\u0430\u0442\u0438\u0432\u043d\u044b\u0435 ETF-\u043f\u043e\u0442\u043e\u043a\u0438";
  }

  if (alt24 < -2) {
    return "\u0421\u043b\u0430\u0431\u043e\u0441\u0442\u044c \u0430\u043b\u044c\u0442\u0440\u044b\u043d\u043a\u0430 \u0438 \u0440\u0438\u0441\u043a \u0431\u043e\u043b\u0435\u0435 \u0433\u043b\u0443\u0431\u043e\u043a\u043e\u0439 \u043a\u043e\u0440\u0440\u0435\u043a\u0446\u0438\u0438";
  }

  if (weakCount >= 4) {
    return "\u0428\u0438\u0440\u043e\u043a\u0430\u044f \u0440\u044b\u043d\u043e\u0447\u043d\u0430\u044f \u0441\u043b\u0430\u0431\u043e\u0441\u0442\u044c \u043f\u043e\u0434 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u044c\u044e";
  }

  return "\u0420\u0438\u0441\u043a \u0440\u0435\u0437\u043a\u043e\u0439 \u0432\u043e\u043b\u0430\u0442\u0438\u043b\u044c\u043d\u043e\u0441\u0442\u0438 \u043d\u0430 \u043d\u043e\u0432\u043e\u0441\u0442\u044f\u0445";
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
    return "\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0435\u043d\u0438\u0435 \u0438\u043d\u0441\u0442\u0438\u0442\u0443\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0441\u043f\u0440\u043e\u0441\u0430 \u0447\u0435\u0440\u0435\u0437 ETF";
  }

  if (alt24 > 2) {
    return "\u0420\u043e\u0442\u0430\u0446\u0438\u044f \u0432 \u0441\u0438\u043b\u044c\u043d\u044b\u0435 \u0430\u043b\u044c\u0442\u043a\u043e\u0438\u043d\u044b";
  }

  if (strongCount >= 4) {
    return "\u041b\u0438\u0434\u0435\u0440\u044b \u0440\u044b\u043d\u043a\u0430 \u0443\u0436\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0435\u043b\u044c\u043d\u0443\u044e \u0441\u0438\u043b\u0443";
  }

  return "\u0422\u043e\u0447\u0435\u0447\u043d\u044b\u0435 \u0441\u0434\u0435\u043b\u043a\u0438 \u0432 \u0441\u0438\u043b\u044c\u043d\u044b\u0445 \u0441\u0435\u043a\u0442\u043e\u0440\u0430\u0445";
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