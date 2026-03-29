import { NextResponse } from "next/server";

import { buildBrief } from "../../../../src/ai-analytics/brief/build-brief";
import { getMarketData } from "../../../../src/ai-analytics/data/get-market-data";
import { getEtfData } from "../../../../src/ai-analytics/data/get-etf-data";
import { getStrengthData } from "../../../../src/ai-analytics/data/get-strength-data";
import { getNewsData } from "../../../../src/ai-analytics/data/get-news-data";
import { getEventsData } from "../../../../src/ai-analytics/data/get-events-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function capture<T>(label: string, fn: () => Promise<T>) {
  const startedAt = Date.now();

  try {
    const data = await fn();

    return {
      ok: true,
      label,
      durationMs: Date.now() - startedAt,
      data,
    };
  } catch (error: any) {
    return {
      ok: false,
      label,
      durationMs: Date.now() - startedAt,
      error: String(error?.message || error),
    };
  }
}

export async function GET() {
  const startedAt = Date.now();

  const [marketRaw, etfRaw, strengthRaw, newsRaw, eventsRaw, briefResult] =
    await Promise.all([
      capture("market", () => getMarketData()),
      capture("etf", () => getEtfData()),
      capture("strength", () => getStrengthData()),
      capture("news", () => getNewsData()),
      capture("events", () => getEventsData()),
      capture("brief", () => buildBrief()),
    ]);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    marketRaw,
    etfRaw,
    strengthRaw,
    newsRaw,
    eventsRaw,
    briefResult,
  });
}