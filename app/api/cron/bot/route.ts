import { NextResponse } from "next/server";
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
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();

    if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
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

    let manageResult: AnyJson = null;
    let engineResult: AnyJson = null;

    try {
      manageResult = await runManage();
    } catch (e: any) {
      manageResult = {
        ok: false,
        message: e?.message ?? String(e),
      };
    }

    try {
      engineResult = await runEngineTick();
    } catch (e: any) {
      engineResult = {
        ok: false,
        message: e?.message ?? String(e),
      };
    }

    return ok({
      message: "cron cycle completed",
      syncedBots: syncResults.length,
      syncResults,
      manageResult,
      engineResult,
      ranAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return fail(500, "SERVER_ERROR", e?.message ?? String(e));
  }
}