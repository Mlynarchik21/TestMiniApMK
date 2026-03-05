// app/api/trades/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type AnyJson = any;

function ok(data: AnyJson = {}) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string, extra?: AnyJson) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser(_req);

    const id = String(ctx.params?.id || "").trim();
    if (!id) return fail(400, "BAD_REQUEST", "id required");

    // 1) удалим события по tradeId (если они есть)
    // 2) удалим саму сделку (только если она принадлежит текущему user)
    const result = await prisma.$transaction(async (tx) => {
      const ev = await tx.$executeRaw(
        Prisma.sql`
          delete from "TradeEvent"
          where "tradeId" = ${id} and "userId" = ${user.id}
        `
      );

      const tr = await tx.$executeRaw(
        Prisma.sql`
          delete from "Trade"
          where "id" = ${id} and "userId" = ${user.id}
        `
      );

      return { deletedEvents: Number(ev || 0), deletedTrades: Number(tr || 0) };
    });

    if (result.deletedTrades === 0) {
      return fail(404, "NOT_FOUND", "trade not found");
    }

    return ok(result);
  } catch (e: AnyJson) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}
