import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    await prisma.botConfig.update({
      where: { userId: user.id },
      data: {
        enabled: false,
      },
    });

    await prisma.botState.update({
      where: { userId: user.id },
      data: {
        status: "STOPPED",
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