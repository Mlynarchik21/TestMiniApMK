import { buildPrompt } from "./build-prompt";
import type { MarketBrief } from "../types/market-brief";

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function extractText(data: GeminiGenerateResponse): string {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("\n")
      .trim() || "";

  return text;
}

export async function generateTelegramPost(brief: MarketBrief): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const prompt = buildPrompt(brief);

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-pro";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 32,
          maxOutputTokens: 1800,
        },
      }),
    }
  );

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${rawText}`);
  }

  let data: GeminiGenerateResponse;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  const text = extractText(data);

  if (!text) {
    throw new Error("Gemini returned empty content");
  }

  return text.trim();
}