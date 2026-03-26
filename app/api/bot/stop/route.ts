import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

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

    const config = await prisma.botConfig.update({
      where: { userId: user.id },
      data: {
        enabled: false,
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

    const state = await prisma.botState.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: "STOPPED",
        lastError: null,
      },
      update: {
        status: "STOPPED",
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

    return ok({
      config: {
        ...config,
        budgetPerSymbol: config.budgetPerSymbol.toString(),
      },
      state,
    });
  } catch (e: any) {
    console.error("BOT STOP ERROR:", e);

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