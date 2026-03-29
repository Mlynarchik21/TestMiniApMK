import { NextResponse } from "next/server";

import { buildMarketBrief } from "@/ai-analytics/brief/build-brief";
import { buildPrompt } from "@/ai-analytics/content/build-prompt";
import { generatePost } from "@/ai-analytics/content/generate-post";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startedAt = Date.now();

    const brief = await buildMarketBrief();
    const prompt = buildPrompt(brief);
    const ai = await generatePost(brief);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,

      brief,
      prompt,
      ai,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "AI_ANALYTICS_RUN_FAILED",
        message: String(error?.message || error),
        stack:
          process.env.NODE_ENV !== "production"
            ? String(error?.stack || "")
            : undefined,
      },
      { status: 500 }
    );
  }
}