import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { runManage } from "@/lib/engine/runManage";
import { runEngineTick } from "@/lib/engine/runEngineTick";
import { syncOpenPositionsForUser } from "@/lib/engine/syncOpenPositions";

export const runtime = "nodejs";

type AnyJson = any;

function ok(data?: AnyJson) {
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

function fail(status: number, error: string, message?: string, extra?: AnyJson) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

export async function GET(req: Request) {
  try {
    // SECURITY: Берём токен из Authorization header (не из URL)
    const authHeader = req.headers.get("authorization") || "";
    const expectedPrefix = "Bearer ";

    if (!authHeader.startsWith(expectedPrefix)) {
      return fail(401, "UNAUTHORIZED", "Missing Bearer token");
    }

    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      return fail(500, "SERVER_ERROR", "CRON_SECRET not configured");
    }

    const token = authHeader.slice(expectedPrefix.length).trim();
    if (token.length < 16 || token.length !== cronSecret.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))) {
      return fail(401, "UNAUTHORIZED", "Invalid cron token");
    }

    const activeBots = await prisma.botConfig.findMany({
      where: {
        enabled: true,
        keyId: { not: null },
      },
      select: {
        userId: true,
      },
    });

    const syncResults: AnyJson[] = [];

    for (const bot of activeBots) {
      try {
        const syncRes = await syncOpenPositionsForUser(bot.userId);
        syncResults.push({
          userId: bot.userId,
          ok: true,
          result: syncRes,
        });
      } catch (e: any) {
        syncResults.push({
          userId: bot.userId,
          ok: false,
          message: e?.message ?? String(e),
        });
      }
    }

    let engineResult: AnyJson = null;
    let manageResult: AnyJson = null;

    try {
      engineResult = await runEngineTick();
    } catch (e: any) {
      engineResult = {
        ok: false,
        message: e?.message ?? String(e),
      };
    }

    try {
      manageResult = await runManage();
    } catch (e: any) {
      manageResult = {
        ok: false,
        message: e?.message ?? String(e),
      };
    }

    return ok({
      message: "cron cycle completed",
      syncedBots: syncResults.length,
      syncResults,
      engineResult,
      manageResult,
      ranAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return fail(500, "SERVER_ERROR", e?.message ?? String(e));
  }
}
