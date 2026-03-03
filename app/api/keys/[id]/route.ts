// app/api/keys/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser();

    const id = String(ctx.params?.id || "").trim();
    if (!id) return json({ ok: false, error: "bad_id" }, { status: 400 });

    const result = await prisma.userKey.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) return json({ ok: false, error: "not_found" }, { status: 404 });

    return json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message },
      { status }
    );
  }
}
