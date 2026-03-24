import { NextResponse } from "next/server";
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
  | "offtopic";

type AIIntentResult = {
  intent: AIIntent;
  symbol: string | null;
  wantsMarketOverview: boolean;
  wantsPriceOnly: boolean;
  wantsExplanation: boolean;
  wantsChartAnalysis: boolean;
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
const GEMINI_MODEL = "gemini-2.5-flash";
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

function buildSystemInstruction() {
  return `
Ты — крипто ассистент внутри торгового мини-приложения.

Ты работаешь ТОЛЬКО с темами:
- криптовалютный рынок
- трейдинг
- монеты, тикеры, пары
- графики
- уровни, зоны, структура цены
- ликвидность, волатильность, объёмы
- новости крипторынка
- макрофакторы, если они влияют на крипту
- анализ скринов графиков и торговых интерфейсов

ЖЁСТКОЕ ПРАВИЛО:
Если запрос не относится к крипторынку, трейдингу, графикам, монетам, уровням, ликвидности или рыночной аналитике,
ты отвечаешь строго одной фразой:

"Я работаю только с крипторынком, графиками и анализом. Задай вопрос по рынку."

Если пользователь присылает картинку не с графиком, не с торговым интерфейсом и не с рыночными данными,
ты отвечаешь строго:
"Я работаю только с крипторынком, графиками и анализом. Задай вопрос по рынку."

СТИЛЬ:
- всегда на русском языке
- коротко, ясно, по делу
- удобно читать с телефона
- без воды
- без таблиц
- максимум пользы, минимум лишнего
- если данных недостаточно, говори об этом прямо

ЗАПРЕЩЕНО:
- выдумывать факты
- выдумывать новости, цены, даты и события
- давать финансовые гарантии
- обещать доходность
- писать как инвестиционный совет

ТЫ ПОЛУЧАЕШЬ НИЖЕ БЛОКИ С ФАКТАМИ ОТ СЕРВЕРА:
- SERVER_MARKET_DATA
- SERVER_GLOBAL_MARKET_DATA

Если эти блоки есть, используй их как главный источник фактов.
Не противоречь им.
Не подменяй их своими цифрами.

ФОРМАТЫ ОТВЕТА:
Ты всегда выбираешь только ОДНУ из 3 структур.

СТРУКТУРА A — для сложных вопросов:
Используй если пользователь просит:
- обзор рынка
- причины движения
- сценарии
- сравнение активов
- что происходит и что дальше

Формат:

TLDR
1 предложение прямого ответа
1–3 нумерованных пункта

Deep Dive
до 3 коротких смысловых блоков

Conclusion
1–3 предложения вывода
без советов покупать или продавать

СТРУКТУРА B — для объяснения:
Используй если пользователь спрашивает:
- что это
- как работает
- в чем разница
- что значит показатель, метрика или механизм

Формат:
2–3 коротких блока
без TLDR / Deep Dive / Conclusion

СТРУКТУРА C — для простого факта:
Используй если пользователь просит:
- короткий факт
- один конкретный показатель
- прямой краткий ответ

Формат:
один короткий абзац
без заголовков
без лишних деталей

ЕСЛИ ПОЛЬЗОВАТЕЛЬ ПРИСЛАЛ СКРИН ГРАФИКА:
- сначала определи общую структуру
- потом выдели ключевые уровни / зоны
- потом дай возможные сценарии
- в конце коротко укажи риски
- не выдумывай индикаторы, которых не видно
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
  return "Я работаю только с крипторынком, графиками и анализом. Задай вопрос по рынку.";
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
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}.`;
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
    "binance",
    "bybit",
    "okx",
    "bitget",
    "bitcoin",
    "ethereum",
    "рипл",
    "сол",
    "солана",
    "биткоин",
    "эфир",
    "альт",
    "альткоин",
    "крипт",
    "крипто",
    "рынок",
    "график",
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
    "макро",
    "доминац",
    "капитализац",
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
    "сетапы",
    "обзор рынка",
    "новости рынка",
    "что по рынку",
    "курс",
    "цена",
    "сколько стоит",
    "что такое",
    "как работает",
    "в чем разница",
    "в чём разница",
    "объясни",
    "расскажи про",
    "что значит",
    "что означает",
    "скрин",
    "чарт",
  ];

  return marketKeywords.some((keyword) => text.includes(keyword));
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

  const wantsMarketOverview = includesAny(text, MARKET_KEYWORDS);
  const wantsPrice = includesAny(text, PRICE_KEYWORDS);
  const wantsAnalysis = includesAny(text, ANALYSIS_KEYWORDS);
  const wantsExplanation = includesAny(text, EXPLAIN_KEYWORDS);
  const wantsChartAnalysis = hasImage || includesAny(text, CHART_KEYWORDS);

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

function getCMCApiKey() {
  const key = process.env.CMC_API_KEY?.trim();
  if (!key) {
    throw new Error("CMC_API_KEY is not set");
  }
  return key;
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

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      json?.status?.error_message ||
      json?.error_message ||
      `CMC request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
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

async function callGemini(params: {
  message: string;
  history: MemoryMessage[];
  imageBase64?: string | null;
  imageMime?: string | null;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

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
        text: "Проанализируй этот скрин. Если это не график, не торговый интерфейс и не рыночные данные — откажись одной фразой. Если это график крипторынка — дай структуру, ключевые уровни, сценарии и риски.",
      });
    }
  }

  const contents: GeminiContent[] = [
    ...historyToGeminiContents(params.history),
    {
      role: "user",
      parts: userParts,
    },
  ];

  const body = {
    system_instruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents,
    generationConfig: {
      temperature: 0.25,
      topP: 0.9,
      maxOutputTokens: 1400,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

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

      session.history.push({
        role: "user",
        text: message,
      });
      session.history.push({
        role: "model",
        text: answer,
      });

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

      session.history.push({
        role: "user",
        text: message,
      });
      session.history.push({
        role: "model",
        text: answer,
      });

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

    if (intentInfo.wantsMarketOverview || intentInfo.intent === "market_overview") {
      try {
        globalMetrics = await getCMCGlobalMetrics();
      } catch {}
    }

    if (message && quote && !image && intentInfo.intent === "price") {
      const answer = buildShortPriceAnswer(quote);

      session.history.push({
        role: "user",
        text: message,
      });
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
          hasQuote: true,
          hasGlobalMetrics: false,
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
      "Используй серверные данные выше как главный источник фактов. Не выдумывай другие цифры. Если серверных данных мало — прямо скажи об этом.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const answer = await callGemini({
      message: enrichedMessage,
      history: session.history,
      imageBase64,
      imageMime,
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