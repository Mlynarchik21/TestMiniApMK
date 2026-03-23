import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth/requireUser";
import { detectAIIntent } from "@/lib/ai-intent";
import { getCMCQuote, getCMCGlobalMetrics } from "@/lib/cmc";

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
  var __aiChatSessions: Map<string, MemorySession> | undefined;
}

function getStore() {
  if (!global.__aiChatSessions) {
    global.__aiChatSessions = new Map();
  }
  return global.__aiChatSessions;
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}

function ok(data: any) {
  return json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string) {
  return json({ ok: false, error, message }, { status });
}

function cleanupExpiredSessions() {
  const now = Date.now();
  const store = getStore();
  for (const [id, s] of store.entries()) {
    if (now - s.updatedAt > SESSION_TTL_MS) {
      store.delete(id);
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
      return { sessionId, session: existing, expired: false };
    }
  }

  return {
    sessionId: randomUUID(),
    session: { userId, updatedAt: Date.now(), history: [] },
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
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((p: any) => p.text || "").join("\n").trim();
}

function buildSystemInstruction(context?: {
  quote?: any;
  global?: any;
}) {
  return `
Ты крипто AI ассистент.

ВАЖНО:
- отвечай только про крипторынок
- если вопрос не по теме → мягко откажи
- не обсуждай дизайн, бытовые темы и т.д.

СТРУКТУРА:

A (анализ):
TLDR + 3 пункта + вывод

B (объяснение):
коротко + 2 блока

C (цена):
1 короткий ответ

ДАННЫЕ РЫНКА:
${context?.quote ? JSON.stringify(context.quote) : ""}
${context?.global ? JSON.stringify(context.global) : ""}
`;
}

async function callGemini(params: {
  message: string;
  history: MemoryMessage[];
  imageBase64?: string | null;
  imageMime?: string | null;
  context?: any;
}) {
  const apiKey = process.env.GEMINI_API_KEY!;
  if (!apiKey) throw new Error("No GEMINI_API_KEY");

  const userParts: GeminiPart[] = [];

  if (params.message) {
    userParts.push({ text: params.message });
  }

  if (params.imageBase64 && params.imageMime) {
    userParts.push({
      inline_data: {
        mime_type: params.imageMime,
        data: params.imageBase64,
      },
    });
  }

  const body = {
    system_instruction: {
      parts: [{ text: buildSystemInstruction(params.context) }],
    },
    contents: [
      ...params.history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: userParts },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return extractGeminiText(data);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const form = await req.formData();
    const message = String(form.get("message") || "").trim();
    const sessionIdRaw = String(form.get("sessionId") || "").trim();

    const file = form.get("image");
    const image = file instanceof File ? file : null;

    if (!message && !image) {
      return fail(400, "BAD_REQUEST", "No input");
    }

    const { sessionId, session } = getOrCreateSession(
      user.id,
      sessionIdRaw
    );

    const intent = detectAIIntent({
      message,
      hasImage: !!image,
    });

    // ❌ OFFTOPIC
    if (intent.intent === "offtopic") {
      return ok({
        answer:
          "Я работаю только с крипторынком. Задай вопрос про рынок, монеты или график.",
        sessionId,
      });
    }

    // 📊 MARKET DATA
    let quote = null;
    let globalMetrics = null;

    if (intent.symbol) {
      try {
        quote = await getCMCQuote(intent.symbol);
      } catch {}
    }

    if (intent.intent === "market_overview") {
      try {
        globalMetrics = await getCMCGlobalMetrics();
      } catch {}
    }

    // ⚡ FAST PRICE
    if (intent.intent === "price" && quote) {
      return ok({
        answer: `${intent.symbol}: $${quote.price.toLocaleString()} (${quote.change24h}%)`,
        sessionId,
      });
    }

    let imageBase64 = null;
    let imageMime = null;

    if (image) {
      const buffer = await image.arrayBuffer();
      imageBase64 = toBase64(buffer);
      imageMime = image.type;
    }

    const answer = await callGemini({
      message,
      history: session.history,
      imageBase64,
      imageMime,
      context: {
        quote,
        global: globalMetrics,
      },
    });

    session.history.push({ role: "user", text: message });
    session.history.push({ role: "model", text: answer });

    saveSession(sessionId, session);

    return ok({
      answer,
      sessionId,
      meta: {
        intent: intent.intent,
        symbol: intent.symbol,
      },
    });
  } catch (e: any) {
    return fail(500, "SERVER_ERROR", e.message);
  }
}