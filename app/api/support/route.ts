// app/api/support/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function fail(s: number, e: string, m?: string) {
  return NextResponse.json({ ok: false, error: e, ...(m ? { message: m } : {}) }, { status: s });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const messages = await prisma.supportMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, text: true, fromUser: true, createdAt: true },
    });

    return ok({ messages });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";

    if (!text) return fail(400, "BAD_REQUEST", "text required");

    const msg = await prisma.supportMessage.create({
      data: { userId: user.id, text, fromUser: true },
      select: { id: true, text: true, fromUser: true, createdAt: true },
    });

    return ok({ message: msg });
  } catch (e: any) {
    const s = typeof e?.status === "number" ? e.status : 500;
    return fail(s, s === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}
