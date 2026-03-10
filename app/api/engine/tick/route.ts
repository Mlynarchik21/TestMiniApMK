import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {

    const bots = await prisma.botConfig.findMany({
      where: {
        enabled: true
      },
      include: {
        user: true
      }
    });

    if (!bots.length) {
      return NextResponse.json({
        ok: true,
        message: "no enabled bots"
      });
    }

    const results: any[] = [];

    for (const bot of bots) {

      const cycle = await prisma.engineCycle.create({
        data: {
          userId: bot.userId,
          exchange: bot.exchange,
          status: "SUCCESS",
          message: "Engine tick executed"
        }
      });

      results.push({
        userId: bot.userId,
        cycleId: cycle.id
      });

    }

    return NextResponse.json({
      ok: true,
      cycles: results
    });

  } catch (e: any) {

    return NextResponse.json({
      ok: false,
      error: "ENGINE_TICK_ERROR",
      message: String(e?.message || e)
    });

  }
}