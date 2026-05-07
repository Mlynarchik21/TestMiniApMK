// lib/gemini.ts
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

type GeminiOk = { ok: true; text: string };
type GeminiErr = { ok: false; error: string };

export async function generateText(opts: {
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<GeminiOk | GeminiErr> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: opts.prompt }] }],
          generationConfig: {
            maxOutputTokens: opts.maxOutputTokens ?? 800,
            temperature: opts.temperature ?? 0.7,
          },
        }),
        signal: controller.signal,
      }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    }

    const text: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return { ok: false, error: "Empty response from Gemini" };

    return { ok: true, text };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "Gemini timeout" : String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}
