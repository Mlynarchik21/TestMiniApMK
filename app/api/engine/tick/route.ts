import { NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

// ✅ Важно: без /api в base
const BINANCE_TESTNET_BASE = "https://testnet.binance.vision";

const STABLE_ASSETS = new Set([
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "BUSD",
  "USDP",
]);

type AnyJson = any;

function sign(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function binanceServerTime(): Promise<number> {
  const r = await fetch(`${BINANCE_TESTNET_BASE}/api/v3/time`, {
    method: "GET",
    cache: "no-store",
  });

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance time error: ${r.status}`);
  }

  const t = Number(json?.serverTime);
  if (!Number.isFinite(t)) {
    throw new Error("Binance serverTime missing");
  }

  return t;
}

async function binanceSpotTestnetAccount(apiKey: string, apiSecret: string) {
  const serverTime = await binanceServerTime();

  const qs = new URLSearchParams({
    timestamp: String(serverTime),
    recvWindow: "10000",
  }).toString();

  const signature = sign(qs, apiSecret);

  const r = await fetch(
    `${BINANCE_TESTNET_BASE}/api/v3/account?${qs}&signature=${signature}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    }
  );

  const text = await r.text();
  let json: AnyJson = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!r.ok) {
    throw new Error(json?.msg || text || `Binance account error: ${r.status}`);
  }

  return json;
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcStableBalances(account: AnyJson) {
  const balances = Array.isArray(account?.balances) ? account.balances : [];

  let totalStable = 0;
  let freeStable = 0;
  let lockedStable = 0;

  for (const b of balances) {
    const asset = String(b?.asset ?? "");
    if (!STABLE_ASSETS.has(asset)) continue;

    const free = toNum(b?.free);
    const locked = toNum(b?.locked);

    freeStable += free;
    lockedStable += locked;
    totalStable += free + locked;
  }

  return {
    totalStable,
    freeStable,
    lockedStable,
  };
}

async function createCycle(userId: string, exchange: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "EngineCycle" (
      "id",
      "userId",
      "exchange",
      "status",
      "message",
      "startedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${userId},
      ${exchange}::"Exchange",
      'STARTED',
      'Engine tick started',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id"
  `);

  return rows[0]?.id ?? null;
}

async function finishCycle(
  cycleId: string,
  status: "SUCCESS" | "SKIPPED" | "ERROR",
  message: string,
  meta?: AnyJson
) {
  const metaJson = meta == null ? null : JSON.stringify(meta);

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "EngineCycle"
    SET
      "status" = ${status},
      "message" = ${message},
      "meta" = ${metaJson}::jsonb,
      "finishedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${cycleId}
  `);
}

async function getLastEntryAt(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ createdAt: Date | string }>>(Prisma.sql`
    SELECT "createdAt"
    FROM "BotOrder"
    WHERE "userId" = ${userId}
      AND "kind" = 'ENTRY'
      AND "status" IN ('NEW', 'PLACED', 'FILLED')
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  return rows[0]?.createdAt ? new Date(rows[0].createdAt) : null;
}

function minutesDiff(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 1000 / 60);
}

async function runEngineTick() {
  const bots = await prisma.botConfig.findMany({
    where: {
      enabled: true,
    },
    select: {
      userId: true,
      exchange: true,
      keyId: true,
      maxActiveSymbols: true,
      budgetPerSymbol: true,
      maxTotalBudget: true,
      syncIntervalMin: true,
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
    const cycleId = await createCycle(bot.userId, bot.exchange);

    try {
      if (!cycleId) {
        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId: null,
          status: "ERROR",
          message: "cycle not created",
        });
        continue;
      }

      if (bot.exchange !== "BINANCE") {
        await finishCycle(cycleId, "SKIPPED", "exchange not supported yet", {
          exchange: bot.exchange,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "exchange not supported yet",
        });
        continue;
      }

      if (!bot.keyId) {
        await finishCycle(cycleId, "SKIPPED", "API key not selected", {});

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "API key not selected",
        });
        continue;
      }

      const key = await prisma.userKey.findFirst({
        where: {
          id: bot.keyId,
          userId: bot.userId,
        },
        select: {
          id: true,
          apiKey: true,
          secretEnc: true,
        },
      });

      if (!key) {
        await finishCycle(cycleId, "SKIPPED", "selected API key not found", {
          keyId: bot.keyId,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "selected API key not found",
        });
        continue;
      }

      const activePositions = await prisma.botPosition.count({
        where: {
          userId: bot.userId,
          status: "OPEN",
        },
      });

      if (activePositions >= 10 || activePositions >= bot.maxActiveSymbols) {
        await finishCycle(cycleId, "SKIPPED", "active positions limit reached", {
          activePositions,
          maxActiveSymbols: bot.maxActiveSymbols,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "active positions limit reached",
        });
        continue;
      }

      const lastEntryAt = await getLastEntryAt(bot.userId);
      if (lastEntryAt) {
        const mins = minutesDiff(lastEntryAt, new Date());

        if (mins < 30) {
          await finishCycle(cycleId, "SKIPPED", "global 30m entry cooldown active", {
            lastEntryAt: lastEntryAt.toISOString(),
            minutesSinceLastEntry: mins,
          });

          results.push({
            userId: bot.userId,
            exchange: bot.exchange,
            cycleId,
            status: "SKIPPED",
            message: "global 30m entry cooldown active",
          });
          continue;
        }
      }

      const apiSecret = decryptString(key.secretEnc);
      const account = await binanceSpotTestnetAccount(key.apiKey, apiSecret);
      const stable = calcStableBalances(account);

      if (stable.totalStable <= 0) {
        await finishCycle(cycleId, "SKIPPED", "no stablecoin capital found", stable);

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "no stablecoin capital found",
        });
        continue;
      }

      const minFreeRequired = stable.totalStable * 0.1;

      if (stable.freeStable <= minFreeRequired) {
        await finishCycle(cycleId, "SKIPPED", "free stable balance is at or below 10%", {
          ...stable,
          minFreeRequired,
        });

        results.push({
          userId: bot.userId,
          exchange: bot.exchange,
          cycleId,
          status: "SKIPPED",
          message: "free stable balance is at or below 10%",
        });
        continue;
      }

      // На этом шаге только подтверждаем готовность к market scan.
      await finishCycle(cycleId, "SUCCESS", "ready for market scan", {
        activePositions,
        totalStable: stable.totalStable,
        freeStable: stable.freeStable,
        lockedStable: stable.lockedStable,
        budgetPerSymbol: bot.budgetPerSymbol.toString(),
        maxTotalBudget: bot.maxTotalBudget?.toString() ?? null,
        syncIntervalMin: bot.syncIntervalMin,
      });

      results.push({
        userId: bot.userId,
        exchange: bot.exchange,
        cycleId,
        status: "SUCCESS",
        message: "ready for market scan",
        balances: stable,
      });
    } catch (e: any) {
      if (cycleId) {
        await finishCycle(cycleId, "ERROR", String(e?.message || e), {});
      }

      results.push({
        userId: bot.userId,
        exchange: bot.exchange,
        cycleId,
        status: "ERROR",
        message: String(e?.message || e),
      });
    }
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