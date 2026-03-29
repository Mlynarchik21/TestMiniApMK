export type Nullable<T> = T | null;

export type PriceSnapshot = {
  symbol: string;
  name: string;
  price: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  volume24h: number | null;
  marketCap: number | null;
};

export type MarketBlock = {
  btc: PriceSnapshot;
  eth: PriceSnapshot;

  altMarketChange24h: number | null;
  altMarketChange7d: number | null;

  btcDominance: number | null;
  ethDominance: number | null;

  totalMarketCap: number | null;
  totalVolume24h: number | null;
};

export type EtfFlowBlock = {
  bitcoinSpotEtfNetflow: number | null;
  ethereumSpotEtfNetflow: number | null;
  summary: string | null;
  tradingDate: string | null;
};

export type StrengthCoin = {
  symbol: string;
  name: string;
  priceChange24h: number | null;
  priceChange7d: number | null;
  volume24h: number | null;
  marketCap: number | null;
};

export type SectorStrength = {
  sector: string;
  change24h: number | null;
  change7d: number | null;
};

export type StrengthBlock = {
  strongerThanMarket: StrengthCoin[];
  weakerThanMarket: StrengthCoin[];
  topGainers: StrengthCoin[];
  topLosers: StrengthCoin[];
  strongSectors: SectorStrength[];
  weakSectors: SectorStrength[];
};

export type NewsItem = {
  title: string;
  summary: string;
  whyItMatters: string;
  source: string | null;
  url: string | null;
  publishedAt: string | null;
  category: string | null;
};

export type NewsBlock = {
  items: NewsItem[];
};

export type EventItem = {
  title: string;
  when: string;
  whyItMatters: string;
  source: string | null;
  url: string | null;
  category: string | null;
};

export type EventsBlock = {
  today: EventItem[];
  tomorrow: EventItem[];
  thisWeek: EventItem[];
};

export type MarketReadBlock = {
  marketState: string | null;
  movementLeader: string | null;
  supportedByEtfAndNews: string | null;
  mainRisk: string | null;
  mainOpportunity: string | null;
};

export type DataQualityBlock = {
  marketOk: boolean;
  etfOk: boolean;
  strengthOk: boolean;
  newsOk: boolean;
  eventsOk: boolean;
};

export type MarketBrief = {
  generatedAt: string;
  market: MarketBlock;
  etf: EtfFlowBlock;
  strength: StrengthBlock;
  news: NewsBlock;
  events: EventsBlock;
  marketRead: MarketReadBlock;
  quality: DataQualityBlock;
};