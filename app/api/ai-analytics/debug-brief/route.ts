import { NextResponse } from "next/server";

import { buildBrief } from "../../../../src/ai-analytics/brief/build-brief";

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
      stack:
        process.env.NODE_ENV !== "production"
          ? String(error?.stack || "")
          : undefined,
    };
  }
}

export async function GET() {
  const startedAt = Date.now();

  const briefResult = await capture("brief", () => buildBrief());

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    briefResult,
  });
}