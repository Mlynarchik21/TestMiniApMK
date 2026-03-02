import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ✅ безопасный JSON: BigInt -> string
function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
    }
  );
}

export async function GET() {
  try {
    const token = cookies().get("session")?.value;

    if (!token) {
      return json({ ok: false, error: "NO_SESSION" }, { status: 401 });
    }

    const tokenHash = sha256hex(token);

    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!session) {
      return json({ ok: false, error: "INVALID_SESSION" }, { status: 401 });
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
      return json({ ok: false, error: "SESSION_EXPIRED" }, { status: 401 });
    }

    return json({
      ok: true,
      user: {
        id: session.user.id,
        tgId: session.user.tgId,
        username: session.user.username,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        createdAt: session.user.createdAt,
      },
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
