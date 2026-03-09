import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const config = await prisma.botConfig.findUnique({
      where: { userId: user.id },
    });

    if (!config) {
      return NextResponse.json(
        { ok: false, error: "BOT_CONFIG_NOT_FOUND" },
        { status: 400 }
      );
    }

    if (!config.keyId) {
      return NextResponse.json(
        { ok: false, error: "API_KEY_NOT_SELECTED" },
        { status: 400 }
      );
    }

    await prisma.botConfig.update({
      where: { userId: user.id },
      data: {
        enabled: true,
      },
    });

    await prisma.botState.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: "RUNNING",
      },
      update: {
        status: "RUNNING",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return NextResponse.json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
        message: e?.message,
      },
      { status }
    );
  }
}