import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type AnyJson = any;

async function runEngineTick() {
  const bots = await prisma.botConfig.findMany({
    where: {
      enabled: true,
    },
    select: {
      userId: true,
      exchange: true,
    },
  });

  if (!bots.length) {
    return {
      ok: true,
      message: "no enabled bots",
      cycles: [],
    };
  }

  const results: AnyJson[] = [];

  for (const bot of bots) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "EngineCycle" (
        "id",
        "userId",
        "exchange",
        "status",
        "message",
        "startedAt",
        "finishedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${bot.userId},
        ${bot.exchange}::"Exchange",
        'SUCCESS',
        'Engine tick executed',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `);

    results.push({
      userId: bot.userId,
      exchange: bot.exchange,
      cycleId: rows[0]?.id ?? null,
    });
  }

  return {
    ok: true,
    cycles: results,
  };
}

export async function GET() {
  try {
    const data = await runEngineTick();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_TICK_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const data = await runEngineTick();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_TICK_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}