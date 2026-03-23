export type AIIntent =
  | "price"
  | "market_overview"
  | "coin_analysis"
  | "explain"
  | "chart_analysis"
  | "offtopic";

export type AIIntentResult = {
  intent: AIIntent;
  symbol: string | null;
  wantsMarketOverview: boolean;
  wantsPriceOnly: boolean;
  wantsExplanation: boolean;
  wantsChartAnalysis: boolean;
};

const KNOWN_SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "BNB",
  "ADA",
  "DOGE",
  "TON",
  "AVAX",
  "DOT",
  "LINK",
  "SUI",
  "TRX",
  "APT",
  "ARB",
  "OP",
  "NEAR",
  "ATOM",
  "LTC",
  "ETC",
];

const RU_SYMBOL_MAP: Array<[RegExp, string]> = [
  [/\bбиткоин\b/i, "BTC"],
  [/\bbtc\b/i, "BTC"],
  [/\bэфир\b/i, "ETH"],
  [/\bэфириум\b/i, "ETH"],
  [/\beth\b/i, "ETH"],
  [/\bсолана\b/i, "SOL"],
  [/\bsol\b/i, "SOL"],
  [/\bрипл\b/i, "XRP"],
  [/\bxrp\b/i, "XRP"],
  [/\bbnb\b/i, "BNB"],
  [/\bтон\b/i, "TON"],
  [/\bton\b/i, "TON"],
  [/\bдог\b/i, "DOGE"],
  [/\bdoge\b/i, "DOGE"],
];

const MARKET_KEYWORDS = [
  "рынок",
  "обзор",
  "что происходит",
  "что по рынку",
  "market",
  "dominance",
  "капитализация",
  "ликвидность",
  "altseason",
  "альтсезон",
  "fear",
  "greed",
  "индекс страха",
  "btc dominance",
  "global",
  "макро",
  "etf",
  "sec",
];

const PRICE_KEYWORDS = [
  "курс",
  "цена",
  "сколько стоит",
  "price",
  "quote",
  "почем",
  "по чем",
];

const ANALYSIS_KEYWORDS = [
  "анализ",
  "сценар",
  "уровн",
  "поддержк",
  "сопротивл",
  "что дальше",
  "куда пойдет",
  "куда пойдёт",
  "прогноз",
  "setup",
  "сетап",
  "структур",
  "trend",
  "тренд",
  "новости",
];

const EXPLAIN_KEYWORDS = [
  "что такое",
  "как работает",
  "в чем разница",
  "в чём разница",
  "объясни",
  "расскажи про",
  "что значит",
  "что означает",
  "как устроен",
  "how works",
];

const CHART_KEYWORDS = [
  "скрин",
  "график",
  "чарт",
  "chart",
  "свеч",
  "таймфрейм",
  "price action",
];

const MARKET_RELATED_KEYWORDS = [
  ...MARKET_KEYWORDS,
  ...PRICE_KEYWORDS,
  ...ANALYSIS_KEYWORDS,
  ...EXPLAIN_KEYWORDS,
  ...CHART_KEYWORDS,
  "btc",
  "eth",
  "sol",
  "xrp",
  "usdt",
  "bitcoin",
  "ethereum",
  "крипто",
  "крипторынок",
  "монета",
  "монеты",
  "альт",
  "трейд",
  "трейдинг",
  "лонг",
  "шорт",
  "фьючерс",
  "спот",
  "объем",
  "объём",
  "rsi",
  "macd",
  "ema",
  "sma",
  "oi",
  "open interest",
  "funding",
  "ликвидац",
];

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

export function extractSymbolFromMessage(message: string): string | null {
  const upper = message.toUpperCase();

  const pairMatch = upper.match(/\b([A-Z0-9]{2,12})(USDT|USD)\b/);
  if (pairMatch?.[1]) return pairMatch[1];

  for (const symbol of KNOWN_SYMBOLS) {
    const re = new RegExp(`\\b${symbol}\\b`, "i");
    if (re.test(message)) return symbol;
  }

  for (const [re, symbol] of RU_SYMBOL_MAP) {
    if (re.test(message)) return symbol;
  }

  return null;
}

export function isLikelyMarketRelated(message: string) {
  const text = message.toLowerCase().trim();
  if (!text) return true;
  return includesAny(text, MARKET_RELATED_KEYWORDS);
}

export function detectAIIntent(params: {
  message: string;
  hasImage?: boolean;
}): AIIntentResult {
  const raw = params.message || "";
  const text = raw.toLowerCase().trim();
  const hasImage = !!params.hasImage;

  const symbol = extractSymbolFromMessage(raw);

  const wantsMarketOverview = includesAny(text, MARKET_KEYWORDS);
  const wantsPrice = includesAny(text, PRICE_KEYWORDS);
  const wantsAnalysis = includesAny(text, ANALYSIS_KEYWORDS);
  const wantsExplanation = includesAny(text, EXPLAIN_KEYWORDS);
  const wantsChartAnalysis =
    hasImage || includesAny(text, CHART_KEYWORDS);

  if (!isLikelyMarketRelated(raw) && !hasImage) {
    return {
      intent: "offtopic",
      symbol,
      wantsMarketOverview: false,
      wantsPriceOnly: false,
      wantsExplanation: false,
      wantsChartAnalysis: false,
    };
  }

  if (wantsChartAnalysis) {
    return {
      intent: "chart_analysis",
      symbol,
      wantsMarketOverview,
      wantsPriceOnly: false,
      wantsExplanation,
      wantsChartAnalysis: true,
    };
  }

  if (wantsMarketOverview && !symbol) {
    return {
      intent: "market_overview",
      symbol,
      wantsMarketOverview: true,
      wantsPriceOnly: false,
      wantsExplanation,
      wantsChartAnalysis: false,
    };
  }

  if (wantsExplanation && !symbol) {
    return {
      intent: "explain",
      symbol,
      wantsMarketOverview,
      wantsPriceOnly: false,
      wantsExplanation: true,
      wantsChartAnalysis: false,
    };
  }

  if (symbol && wantsPrice && !wantsAnalysis && !wantsMarketOverview) {
    return {
      intent: "price",
      symbol,
      wantsMarketOverview: false,
      wantsPriceOnly: true,
      wantsExplanation: false,
      wantsChartAnalysis: false,
    };
  }

  if (symbol) {
    return {
      intent: "coin_analysis",
      symbol,
      wantsMarketOverview,
      wantsPriceOnly: wantsPrice && !wantsAnalysis,
      wantsExplanation,
      wantsChartAnalysis: false,
    };
  }

  if (wantsPrice) {
    return {
      intent: "price",
      symbol: null,
      wantsMarketOverview: false,
      wantsPriceOnly: true,
      wantsExplanation: false,
      wantsChartAnalysis: false,
    };
  }

  if (wantsExplanation) {
    return {
      intent: "explain",
      symbol,
      wantsMarketOverview,
      wantsPriceOnly: false,
      wantsExplanation: true,
      wantsChartAnalysis: false,
    };
  }

  return {
    intent: "market_overview",
    symbol,
    wantsMarketOverview: true,
    wantsPriceOnly: false,
    wantsExplanation: false,
    wantsChartAnalysis: false,
  };
}