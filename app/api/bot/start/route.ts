import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { runManage } from "@/lib/engine/runManage";

export const runtime = "nodejs";

function ok(data?: any) {
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

function fail(status: number, error: string, message?: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const config = await prisma.botConfig.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        userId: true,
        exchange: true,
        keyId: true,
        enabled: true,
        maxActiveSymbols: true,
        budgetPerSymbol: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return fail(400, "BOT_CONFIG_NOT_FOUND", "Bot config not found");
    }

    if (!config.keyId) {
      return fail(400, "API_KEY_NOT_SELECTED", "API key not selected");
    }

    const updatedConfig = await prisma.botConfig.update({
      where: { userId: user.id },
      data: {
        enabled: true,
      },
      select: {
        id: true,
        userId: true,
        exchange: true,
        keyId: true,
        enabled: true,
        maxActiveSymbols: true,
        budgetPerSymbol: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let state = await prisma.botState.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: "RUNNING",
        lastError: null,
      },
      update: {
        status: "RUNNING",
        lastError: null,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    let syncResult: any = null;

    try {
      syncResult = await runManage();

      state = await prisma.botState.update({
        where: { userId: user.id },
        data: {
          status: "RUNNING",
          lastSyncAt: new Date(),
          lastError: null,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          lastSyncAt: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (syncError: any) {
      state = await prisma.botState.update({
        where: { userId: user.id },
        data: {
          status: "RUNNING",
          lastError: syncError?.message ?? String(syncError),
        },
        select: {
          id: true,
          userId: true,
          status: true,
          lastSyncAt: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return ok({
      config: {
        ...updatedConfig,
        budgetPerSymbol: updatedConfig.budgetPerSymbol.toString(),
      },
      state,
      startupSync: syncResult,
    });
  } catch (e: any) {
    console.error("BOT START ERROR:", e);

    const status = typeof e?.status === "number" ? e.status : 500;

    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e),
      {
        stack: e?.stack ?? null,
      }
    );
  }
}