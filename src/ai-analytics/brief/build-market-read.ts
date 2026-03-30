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
    return "Risk-on, broad market strength";
  }

  if (btc24 > 2 && alt24 < 1) {
    return "BTC-led market";
  }

  if (eth24 > btc24 && alt24 > btc24) {
    return "Rotation into ETH and altcoins";
  }

  if (btc24 < 0 && eth24 < 0 && alt24 < 0) {
    return "Risk-off, broad market pressure";
  }

  return "Mixed market / transition phase";
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
    return "Supported by ETF flows and news";
  }

  if (total > 0) {
    return "Partially supported by ETF flows";
  }

  if (total < 0) {
    return "ETF flows are a headwind";
  }

  if (hasNews) {
    return "Driven more by news than ETF support";
  }

  return "Weak / neutral support";
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
    return "Negative ETF flows";
  }

  if (alt24 < -2) {
    return "Alt market weakness and deeper pullback risk";
  }

  if (weakCount >= 4) {
    return "Broad underlying market weakness";
  }

  return "News-driven volatility risk";
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
    return "Institutional bid through ETF flows";
  }

  if (alt24 > 2) {
    return "Rotation into strong altcoins";
  }

  if (strongCount >= 4) {
    return "Market leaders already show relative strength";
  }

  return "Selective trades in strong sectors";
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