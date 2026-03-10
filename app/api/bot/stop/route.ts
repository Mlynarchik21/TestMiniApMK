import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

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
        maxTotalBudget: true,
        syncIntervalMin: true,
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

    return NextResponse.json({
      ok: true,
      config: {
        ...config,
        budgetPerSymbol: config.budgetPerSymbol.toString(),
        maxTotalBudget: config.maxTotalBudget?.toString() ?? null,
      },
      state,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return NextResponse.json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
        message: e?.message ?? String(e),
      },
      { status }
    );
  }
}