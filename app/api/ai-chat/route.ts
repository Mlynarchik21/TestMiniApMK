import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

type MemoryMessage = {
  role: "user" | "model";
  text: string;
};

type MemorySession = {
  userId: string;
  updatedAt: number;
  history: MemoryMessage[];
};

type GeminiPart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type AIIntent =
  | "price"
  | "market_overview"
  | "coin_analysis"
  | "explain"
  | "chart_analysis"
  | "news_search"
  | "live_coin_snapshot"
  | "offtopic";

type AIIntentResult = {
  intent: AIIntent;
  symbol: string | null;
  wantsMarketOverview: boolean;
  wantsPriceOnly: boolean;
  wantsExplanation: boolean;
  wantsChartAnalysis: boolean;
  wantsWebSearch: boolean;
};

type CMCQuoteResult = {
  symbol: string;
  price: number;
  percentChange24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string | null;
};

type CMCGlobalResult = {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChange24h: number;
  lastUpdated: string | null;
};

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 20;
const GEMINI_MODEL = "gemini-3.1-pro-preview";
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com/v1";

declare global {
  // eslint-disable-next-line no-var
  var __aiChatSessions: Map<string, MemorySession> | undefined;
}

function getStore() {
  if (!global.__aiChatSessions) {
    global.__aiChatSessions = new Map<string, MemorySession>();
  }
  return global.__aiChatSessions;
}

function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

function ok(data: any) {
  return json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string, extra?: any) {
  return json(
    {
      ok: false,
      error,
      ...(message ? { message } : {}),
      ...(extra || {}),
    },
    { status }
  );
}

function cleanupExpiredSessions() {
  const now = Date.now();
  const store = getStore();

  for (const [sessionId, session] of store.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      store.delete(sessionId);
    }
  }
}

function getOrCreateSession(userId: string, sessionIdRaw?: string | null) {
  cleanupExpiredSessions();

  const store = getStore();
  const sessionId = (sessionIdRaw || "").trim();

  if (sessionId) {
    const existing = store.get(sessionId);

    if (existing && existing.userId === userId) {
      const expired = Date.now() - existing.updatedAt > SESSION_TTL_MS;

      if (expired) {
        store.delete(sessionId);
        return {
          sessionId: randomUUID(),
          session: {
            userId,
            updatedAt: Date.now(),
            history: [] as MemoryMessage[],
          },
          expired: true,
        };
      }

      return {
        sessionId,
        session: existing,
        expired: false,
      };
    }
  }

  return {
    sessionId: randomUUID(),
    session: {
      userId,
      updatedAt: Date.now(),
      history: [] as MemoryMessage[],
    },
    expired: false,
  };
}

function saveSession(sessionId: string, session: MemorySession) {
  session.updatedAt = Date.now();

  if (session.history.length > MAX_HISTORY_ITEMS) {
    session.history = session.history.slice(-MAX_HISTORY_ITEMS);
  }

  getStore().set(sessionId, session);
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function extractGeminiText(payload: any): string {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;

    const texts = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean);

    if (texts.length) {
      return texts.join("\n").trim();
    }
  }

  return "";
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return apiKey;
}

function getCMCApiKey() {
  const key = process.env.CMC_API_KEY?.trim();
  if (!key) {
    throw new Error("CMC_API_KEY is not set");
  }
  return key;
}

function buildSystemInstruction() {
  return `
Ты — крипто ассистент внутри торгового мини-приложения.

Твоя главная специализация:
- криптовалютный рынок
- трейдинг
- монеты, тикеры и пары
- графики и торговые интерфейсы
- уровни, зоны, структура цены
- ликвидность, волатильность, объёмы
- новости крипторынка
- ETF, притоки/оттоки, институциональные потоки
- макрофакторы, если они влияют на крипту
- анализ скринов графиков и рыночных интерфейсов

ОБЩИЙ СТИЛЬ:
- всегда отвечай на русском
- коротко, ясно, по делу
- удобно читать с телефона
- без воды
- дружелюбно, спокойно, уверенно
- не выдумывай факты, цены, новости и даты
- если данных недостаточно, говори это прямо
- не давай финансовых гарантий
- не обещай доходность
- не формулируй ответ как инвестиционную рекомендацию

ВАЖНОЕ ПОВЕДЕНИЕ:
1. Если пользователь пишет нейтральное сообщение вроде:
- "привет"
- "здравствуй"
- "добрый вечер"
- "спасибо"
- "ок"
- "понял"
- "как дела"
то НЕ отказывай.
Ответь коротко и дружелюбно, а затем мягко верни к теме рынка.

2. Если запрос явно не относится к крипторынку, трейдингу, графикам, рыночным данным, ETF, монетам или аналитике,
ответь мягким redirect-ответом:
"Я в первую очередь помогаю с крипторынком, графиками и анализом. Если хочешь, можем разобрать рынок, монету, новости или скрин графика."

3. Если прислана картинка не с графиком, не с торговым интерфейсом и не с рыночными данными,
ответь мягко:
"Я в первую очередь анализирую крипторынок, графики и торговые интерфейсы. Если хочешь, пришли скрин графика или задай вопрос по рынку."

ТЫ МОЖЕШЬ ПОЛУЧИТЬ СЕРВЕРНЫЕ БЛОКИ:
- SERVER_MARKET_DATA
- SERVER_GLOBAL_MARKET_DATA

Если эти блоки есть:
- используй их как главный слой фактов
- не противоречь им
- не заменяй их своими цифрами

КРИТИЧЕСКОЕ ПРАВИЛО ТОЧНОСТИ:
- если сервер не передал точные уровни, диапазоны, ликвидность, funding, open interest или техиндикаторы, ты не имеешь права придумывать их сам как точные значения
- в таком случае говори только качественно: "зона выглядит важной", "без дополнительных данных точный уровень не подтверждён"
- если вопрос про текущую цену, изменение, капитализацию, dominance или объём — используй только SERVER_MARKET_DATA / SERVER_GLOBAL_MARKET_DATA
- не пиши точные внутридневные диапазоны без явного источника
- не пиши "сейчас торгуется в диапазоне X–Y", если этот диапазон не был передан сервером

ФОРМАТЫ ОТВЕТА:
Выбирай только одну структуру.

СТРУКТУРА A — сложный вопрос:
Используй для:
- обзора рынка
- причин движения
- сценариев
- сравнения активов
- вопросов "что происходит" и "что дальше"

Формат:
TLDR
1 короткое предложение прямого ответа
1–3 нумерованных пункта

Deep Dive
до 3 коротких смысловых блоков:
- рынок / актив
- новости / макро / ETF
- ликвидность / сценарии / риски

Conclusion
1–3 предложения вывода
без советов покупать или продавать

СТРУКТУРА B — объяснение:
Используй для:
- что это
- как работает
- в чем разница
- что значит метрика

Формат:
2–3 коротких блока
без TLDR / Deep Dive / Conclusion

СТРУКТУРА C — прямой факт:
Используй для:
- цена
- один показатель
- короткий конкретный ответ

Формат:
один короткий абзац
без заголовков
без лишних деталей

ЕСЛИ АНАЛИЗИРУЕШЬ СКРИН:
- сначала определи структуру
- потом уровни / зоны
- потом сценарии
- потом риски
- не выдумывай невидимые индикаторы
- не придумывай таймфрейм, если он не читается
`.trim();
}

function historyToGeminiContents(history: MemoryMessage[]): GeminiContent[] {
  return history.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }],
  }));
}

function marketOnlyRefusal() {
  return "Я в первую очередь помогаю с крипторынком, графиками и анализом. Если хочешь, можем разобрать рынок, монету, новости или скрин графика.";
}

function imageOnlyRefusal() {
  return "Я в первую очередь анализирую крипторынок, графики и торговые интерфейсы. Если хочешь, пришли скрин графика или задай вопрос по рынку.";
}

function isDateQuestion(text: string) {
  const t = text.toLowerCase().trim();

  return (
    t.includes("какой сегодня день") ||
    t.includes("какая сегодня дата") ||
    t.includes("какое сегодня число") ||
    t.includes("какой сегодня месяц") ||
    t.includes("какой сегодня год") ||
    t.includes("сколько сейчас времени") ||
    t.includes("сколько время") ||
    t.includes("который час") ||
    t.includes("какое сейчас время") ||
    t === "дата" ||
    t === "время"
  );
}

function buildServerDateAnswer() {
  const now = new Date();

  return `Сейчас ${now.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}.`;
}

function isGreetingMessage(text: string) {
  const t = text.toLowerCase().trim();

  const greetings = [
    "привет",
    "здравствуй",
    "здравствуйте",
    "добрый день",
    "доброе утро",
    "добрый вечер",
    "хай",
    "hello",
    "hi",
    "hey",
    "как дела",
    "как ты",
    "что нового",
    "спасибо",
    "благодарю",
    "ок",
    "понял",
    "ясно",
  ];

  return greetings.includes(t);
}

function buildGreetingAnswer(text: string) {
  const t = text.toLowerCase().trim();

  if (t.includes("спасибо") || t === "благодарю") {
    return "Пожалуйста. Если хочешь, могу сразу помочь с обзором рынка, монетой, новостями или анализом скрина графика.";
  }

  if (t.includes("как дела") || t.includes("как ты")) {
    return "Все отлично. Готов помочь с рынком, новостями, ETF, монетами или анализом графика. Что разберем?";
  }

  if (t === "ок" || t === "понял" || t === "ясно") {
    return "Хорошо. Если хочешь, можем перейти к рынку: обзор дня, конкретная монета, ETF-потоки или анализ графика.";
  }

  return "Привет. Готов помочь с рынком, монетами, графиками, новостями и ETF. Что хочешь разобрать?";
}

function includesAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function extractSymbolFromMessage(message: string): string | null {
  const upper = message.toUpperCase();

  const pairMatch = upper.match(/\b([A-Z0-9]{2,12})(USDT|USD)\b/);
  if (pairMatch?.[1]) return pairMatch[1];

  const known = [
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

  for (const symbol of known) {
    const re = new RegExp(`\\b${symbol}\\b`, "i");
    if (re.test(message)) return symbol;
  }

  const ruMap: Array<[RegExp, string]> = [
    [/\bбиткоин\b/i, "BTC"],
    [/\bбиткойн\b/i, "BTC"],
    [/\bbitcoin\b/i, "BTC"],
    [/\bbtc\b/i, "BTC"],

    [/\bэфир\b/i, "ETH"],
    [/\bэфириум\b/i, "ETH"],
    [/\bethereum\b/i, "ETH"],
    [/\beth\b/i, "ETH"],

    [/\bсолана\b/i, "SOL"],
    [/\bsolana\b/i, "SOL"],
    [/\bsol\b/i, "SOL"],

    [/\bрипл\b/i, "XRP"],
    [/\bripple\b/i, "XRP"],
    [/\bxrp\b/i, "XRP"],

    [/\bbnb\b/i, "BNB"],
    [/\bтон\b/i, "TON"],
    [/\bton\b/i, "TON"],
    [/\bdoge\b/i, "DOGE"],
    [/\bдог\b/i, "DOGE"],
  ];

  for (const [re, symbol] of ruMap) {
    if (re.test(message)) return symbol;
  }

  return null;
}

function isLikelyMarketRelated(message: string) {
  const text = message.toLowerCase().trim();
  if (!text) return true;

  const marketKeywords = [
    "btc",
    "eth",
    "xrp",
    "sol",
    "usdt",
    "bnb",
    "ton",
    "doge",
    "ada",
    "avax",
    "dot",
    "link",
    "bitcoin",
    "ethereum",
    "биткоин",
    "биткойн",
    "эфир",
    "эфириум",
    "солана",
    "рипл",
    "рынок",
    "крипто",
    "крипторынок",
    "график",
    "чарт",
    "скрин",
    "свеч",
    "уров",
    "зона",
    "структур",
    "ликвид",
    "трейд",
    "трейдинг",
    "лонг",
    "шорт",
    "фьючерс",
    "спот",
    "объем",
    "объём",
    "волатиль",
    "капитализац",
    "доминац",
    "монет",
    "тикер",
    "pair",
    "price",
    "chart",
    "support",
    "resistance",
    "oi",
    "open interest",
    "funding",
    "liquidation",
    "ликвидац",
    "etf",
    "sec",
    "приток",
    "отток",
    "flow",
    "flows",
    "rsi",
    "macd",
    "ema",
    "sma",
    "pivot",
    "fibo",
    "фибо",
    "таймфрейм",
    "перп",
    "перпетуал",
    "сквиз",
    "сетап",
    "новости рынка",
    "что по рынку",
    "цена",
    "курс",
    "сколько стоит",
    "что такое",
    "как работает",
    "в чем разница",
    "в чём разница",
    "объясни",
    "что произошло",
    "что происходит",
  ];

  return marketKeywords.some((keyword) => text.includes(keyword));
}

function isLiveCoinStatusQuestion(message: string, symbol: string | null) {
  if (!symbol) return false;

  const t = message.toLowerCase();

  return (
    t.includes("что сейчас") ||
    t.includes("что с ") ||
    t.includes("что по ") ||
    t.includes("какая ситуация") ||
    t.includes("что происходит с") ||
    t.includes("что происходит по") ||
    t.includes("кратко по") ||
    t.includes("что сейчас с биткоином") ||
    t.includes("что сейчас с btc") ||
    t.includes("что по btc") ||
    t.includes("что по биткоину")
  );
}

function detectAIIntent(params: {
  message: string;
  hasImage?: boolean;
}): AIIntentResult {
  const raw = params.message || "";
  const text = raw.toLowerCase().trim();
  const hasImage = !!params.hasImage;
  const symbol = extractSymbolFromMessage(raw);

  const MARKET_KEYWORDS = [
    "рынок",
    "обзор",
    "что происходит",
    "что произошло",
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

  const NEWS_KEYWORDS = [
    "новости",
    "etf",
    "притоки",
    "оттоки",
    "flow",
    "flows",
    "институцион",
    "sec",
    "что произошло",
    "что происходит",
    "за сутки",
    "за 24 часа",
    "за неделю",
  ];

  const wantsMarketOverview = includesAny(text, MARKET_KEYWORDS);
  const wantsPrice = includesAny(text, PRICE_KEYWORDS);
  const wantsAnalysis = includesAny(text, ANALYSIS_KEYWORDS);
  const wantsExplanation = includesAny(text, EXPLAIN_KEYWORDS);
  const wantsChartAnalysis = hasImage || includesAny(text, CHART_KEYWORDS);
  const wantsNews = includesAny(text, NEWS_KEYWORDS);

  if (!isLikelyMarketRelated(raw) && !hasImage) {
    return {
      intent: "offtopic",
      symbol,
      wantsMarketOverview: false,
      wantsPriceOnly: false,
      wantsExplanation: false,
      wantsChartAnalysis: false,
      wantsWebSearch: false,
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
      wantsWebSearch: false,
    };
  }

  if (wantsNews) {
    return {
      intent: symbol ? "coin_analysis" : "news_search",
      symbol,
      wantsMarketOverview: wantsMarketOverview || !symbol,
      wantsPriceOnly: false,
      wantsExplanation: false,
      wantsChartAnalysis: false,
      wantsWebSearch: true,
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
      wantsWebSearch: true,
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
      wantsWebSearch: false,
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
      wantsWebSearch: false,
    };
  }

  if (symbol && isLiveCoinStatusQuestion(raw, symbol)) {
    return {
      intent: "live_coin_snapshot",
      symbol,
      wantsMarketOverview: true,
      wantsPriceOnly: false,
      wantsExplanation: false,
      wantsChartAnalysis: false,
      wantsWebSearch: false,
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
      wantsWebSearch: wantsNews || wantsMarketOverview,
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
      wantsWebSearch: false,
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
      wantsWebSearch: false,
    };
  }

  return {
    intent: "market_overview",
    symbol,
    wantsMarketOverview: true,
    wantsPriceOnly: false,
    wantsExplanation: false,
    wantsChartAnalysis: false,
    wantsWebSearch: true,
  };
}

async function cmcFetch<T = any>(path: string, params?: Record<string, string>) {
  const apiKey = getCMCApiKey();
  const url = new URL(`${CMC_BASE_URL}${path}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": apiKey,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      data?.status?.error_message ||
      data?.error_message ||
      `CMC request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

function normalizeSymbol(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/USDT$/, "")
    .replace(/USD$/, "");
}

async function getCMCQuote(rawSymbol: string): Promise<CMCQuoteResult | null> {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return null;

  const json = await cmcFetch<{
    data?: Record<
      string,
      {
        symbol: string;
        quote?: {
          USD?: {
            price?: number;
            percent_change_24h?: number;
            volume_24h?: number;
            market_cap?: number;
            last_updated?: string;
          };
        };
      }
    >;
  }>("/cryptocurrency/quotes/latest", {
    symbol,
    convert: "USD",
  });

  const item = json?.data?.[symbol];
  const usd = item?.quote?.USD;

  if (!item || !usd) return null;

  return {
    symbol: item.symbol,
    price: Number(usd.price ?? 0),
    percentChange24h: Number(usd.percent_change_24h ?? 0),
    volume24h: Number(usd.volume_24h ?? 0),
    marketCap: Number(usd.market_cap ?? 0),
    lastUpdated: usd.last_updated ?? null,
  };
}

async function getCMCGlobalMetrics(): Promise<CMCGlobalResult | null> {
  const json = await cmcFetch<{
    data?: {
      quote?: {
        USD?: {
          total_market_cap?: number;
          total_volume_24h?: number;
          total_market_cap_yesterday_percentage_change?: number;
          btc_dominance?: number;
          eth_dominance?: number;
          last_updated?: string;
        };
      };
    };
  }>("/global-metrics/quotes/latest", {
    convert: "USD",
  });

  const usd = json?.data?.quote?.USD;
  if (!usd) return null;

  return {
    totalMarketCap: Number(usd.total_market_cap ?? 0),
    totalVolume24h: Number(usd.total_volume_24h ?? 0),
    btcDominance: Number(usd.btc_dominance ?? 0),
    ethDominance: Number(usd.eth_dominance ?? 0),
    marketCapChange24h: Number(
      usd.total_market_cap_yesterday_percentage_change ?? 0
    ),
    lastUpdated: usd.last_updated ?? null,
  };
}

function formatUsdCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatNumberCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildCMCFactsBlock(params: {
  quote?: CMCQuoteResult | null;
  global?: CMCGlobalResult | null;
}) {
  const chunks: string[] = [];

  if (params.quote) {
    chunks.push(
      [
        "SERVER_MARKET_DATA",
        `Символ: ${params.quote.symbol}`,
        `Цена USD: ${params.quote.price}`,
        `Изменение 24ч %: ${params.quote.percentChange24h}`,
        `Объём 24ч USD: ${params.quote.volume24h}`,
        `Капитализация USD: ${params.quote.marketCap}`,
        `Последнее обновление: ${params.quote.lastUpdated ?? "—"}`,
      ].join("\n")
    );
  }

  if (params.global) {
    chunks.push(
      [
        "SERVER_GLOBAL_MARKET_DATA",
        `Общая капитализация USD: ${params.global.totalMarketCap}`,
        `Общий объём 24ч USD: ${params.global.totalVolume24h}`,
        `BTC dominance %: ${params.global.btcDominance}`,
        `ETH dominance %: ${params.global.ethDominance}`,
        `Изменение капитализации 24ч %: ${params.global.marketCapChange24h}`,
        `Последнее обновление: ${params.global.lastUpdated ?? "—"}`,
      ].join("\n")
    );
  }

  return chunks.join("\n\n");
}

function buildShortPriceAnswer(quote: CMCQuoteResult) {
  const sign = quote.percentChange24h >= 0 ? "+" : "";
  return `${quote.symbol} сейчас около ${formatUsdCompact(
    quote.price
  )}. За 24 часа: ${sign}${quote.percentChange24h.toFixed(
    2
  )}%. Объём 24ч: ${formatNumberCompact(
    quote.volume24h
  )} USD, капитализация: ${formatNumberCompact(quote.marketCap)} USD.`;
}

function buildCoinSnapshotAnswer(params: {
  quote: CMCQuoteResult;
  global?: CMCGlobalResult | null;
}) {
  const { quote, global } = params;
  const sign = quote.percentChange24h >= 0 ? "+" : "";

  const lines = [
    `${quote.symbol} сейчас около ${formatUsdCompact(quote.price)}.`,
    `За 24 часа: ${sign}${quote.percentChange24h.toFixed(2)}%.`,
    `Объём за 24ч: ${formatNumberCompact(quote.volume24h)} USD.`,
    `Капитализация: ${formatNumberCompact(quote.marketCap)} USD.`,
  ];

  if (global) {
    lines.push(
      `BTC dominance: ${global.btcDominance.toFixed(2)}%, ETH dominance: ${global.ethDominance.toFixed(2)}%.`
    );
  }

  if (quote.lastUpdated) {
    lines.push(
      `Обновлено: ${new Date(quote.lastUpdated).toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}.`
    );
  }

  return lines.join(" ");
}

async function callGemini(params: {
  message: string;
  history: MemoryMessage[];
  imageBase64?: string | null;
  imageMime?: string | null;
  useGoogleSearch?: boolean;
}) {
  const apiKey = getGeminiApiKey();

  const userParts: GeminiPart[] = [];

  if (params.message.trim()) {
    userParts.push({ text: params.message.trim() });
  }

  if (params.imageBase64 && params.imageMime) {
    userParts.push({
      inline_data: {
        mime_type: params.imageMime,
        data: params.imageBase64,
      },
    });

    if (!params.message.trim()) {
      userParts.push({
        text: "Проанализируй этот скрин. Если это не график, не торговый интерфейс и не рыночные данные — ответь мягко, что ты в первую очередь работаешь с крипторынком, графиками и торговыми интерфейсами. Если это график крипторынка — дай структуру, ключевые уровни, сценарии и риски.",
      });
    }
  }

  const body: any = {
    system_instruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      ...historyToGeminiContents(params.history),
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1800,
    },
  };

  if (params.useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      payload?.error?.message ||
      payload?.message ||
      `Gemini request failed with status ${res.status}`;
    throw new Error(msg);
  }

  const text = extractGeminiText(payload);

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return text.trim();
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const form = await req.formData();
    const message = String(form.get("message") || "").trim();
    const sessionIdRaw = String(form.get("sessionId") || "").trim();

    const file = form.get("image");
    const image = file instanceof File && file.size > 0 ? file : null;

    if (!message && !image) {
      return fail(400, "BAD_REQUEST", "message or image required");
    }

    if (image && image.size > 10 * 1024 * 1024) {
      return fail(400, "IMAGE_TOO_LARGE", "Максимальный размер изображения — 10 МБ.");
    }

    const { sessionId, session, expired } = getOrCreateSession(user.id, sessionIdRaw);

    if (message && !image && isDateQuestion(message)) {
      const answer = buildServerDateAnswer();

      session.history.push({ role: "user", text: message });
      session.history.push({ role: "model", text: answer });
      saveSession(sessionId, session);

      return ok({
        answer,
        sessionId,
        expired,
      });
    }

    if (message && !image && isGreetingMessage(message)) {
      const answer = buildGreetingAnswer(message);

      session.history.push({ role: "user", text: message });
      session.history.push({ role: "model", text: answer });
      saveSession(sessionId, session);

      return ok({
        answer,
        sessionId,
        expired,
      });
    }

    const intentInfo = detectAIIntent({
      message,
      hasImage: !!image,
    });

    if (message && !image && intentInfo.intent === "offtopic") {
      const answer = marketOnlyRefusal();

      session.history.push({ role: "user", text: message });
      session.history.push({ role: "model", text: answer });
      saveSession(sessionId, session);

      return ok({
        answer,
        sessionId,
        expired,
      });
    }

    let imageBase64: string | null = null;
    let imageMime: string | null = null;

    if (image) {
      const arrayBuffer = await image.arrayBuffer();
      imageBase64 = toBase64(arrayBuffer);
      imageMime = image.type || "image/png";
    }

    let quote: CMCQuoteResult | null = null;
    let globalMetrics: CMCGlobalResult | null = null;

    if (intentInfo.symbol) {
      try {
        quote = await getCMCQuote(intentInfo.symbol);
      } catch {}
    }

    if (
      intentInfo.wantsMarketOverview ||
      intentInfo.intent === "market_overview" ||
      intentInfo.intent === "live_coin_snapshot"
    ) {
      try {
        globalMetrics = await getCMCGlobalMetrics();
      } catch {}
    }

    if (message && quote && !image && intentInfo.intent === "price") {
      const answer = buildShortPriceAnswer(quote);

      session.history.push({ role: "user", text: message });
      session.history.push({ role: "model", text: answer });
      saveSession(sessionId, session);

      return ok({
        answer,
        sessionId,
        expired,
        meta: {
          intent: intentInfo.intent,
          symbol: intentInfo.symbol,
          hasQuote: true,
          hasGlobalMetrics: false,
          usedGoogleSearch: false,
          model: "server-factual",
        },
      });
    }

    if (message && quote && !image && intentInfo.intent === "live_coin_snapshot") {
      const answer = buildCoinSnapshotAnswer({
        quote,
        global: globalMetrics,
      });

      session.history.push({ role: "user", text: message });
      session.history.push({ role: "model", text: answer });
      saveSession(sessionId, session);

      return ok({
        answer,
        sessionId,
        expired,
        meta: {
          intent: "live_coin_snapshot",
          symbol: intentInfo.symbol,
          hasQuote: true,
          hasGlobalMetrics: !!globalMetrics,
          usedGoogleSearch: false,
          model: "server-factual",
        },
      });
    }

    const factsBlock = buildCMCFactsBlock({
      quote,
      global: globalMetrics,
    });

    const enrichedMessage = [
      factsBlock ? factsBlock : "",
      "USER_REQUEST",
      message || (image ? "Проанализируй изображение." : ""),
      "",
      "ИНСТРУКЦИЯ",
      "Используй серверные данные выше как главный источник фактов. Если запрос связан с текущей ценой, изменением за 24ч, капитализацией, dominance, объёмом, ETF-потоками или новостями — не выдумывай числа. Если точных уровней, диапазонов, funding, open interest, ликвидаций или техиндикаторов сервер не передал, не пиши их как точные факты. В этом случае формулируй осторожно и явно помечай как общий сценарный вывод, а не как точное рыночное значение.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const answer = await callGemini({
      message: enrichedMessage,
      history: session.history,
      imageBase64,
      imageMime,
      useGoogleSearch: intentInfo.wantsWebSearch,
    });

    if (message) {
      session.history.push({
        role: "user",
        text: message,
      });
    } else if (image) {
      session.history.push({
        role: "user",
        text: "[image uploaded]",
      });
    }

    session.history.push({
      role: "model",
      text: answer,
    });

    saveSession(sessionId, session);

    return ok({
      answer,
      sessionId,
      expired,
      meta: {
        intent: intentInfo.intent,
        symbol: intentInfo.symbol,
        hasQuote: !!quote,
        hasGlobalMetrics: !!globalMetrics,
        usedGoogleSearch: intentInfo.wantsWebSearch,
        model: GEMINI_MODEL,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? "Unknown error"
    );
  }
}