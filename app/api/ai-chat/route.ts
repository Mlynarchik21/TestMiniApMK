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

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 20;
const GEMINI_MODEL = "gemini-2.5-flash";

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

Никаких дополнительных пояснений.
Никаких альтернатив.
Никакой помощи в других темах.

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
до 3 смысловых блоков
каждый блок короткий
каждый блок раскрывает один аспект:
- рынок
- новости / макро
- ликвидность / сценарии / риски

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
каждый начинается с понятного тезиса
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
  ];

  return marketKeywords.some((keyword) => text.includes(keyword));
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
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 1200,
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

    // 1. Отдельная серверная обработка даты/времени
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

    // 2. Жёсткий текстовый фильтр вне рынка
    if (message && !image && !isLikelyMarketRelated(message)) {
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

    const answer = await callGemini({
      message,
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