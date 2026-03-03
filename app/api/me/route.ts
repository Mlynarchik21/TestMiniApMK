// app/api/me/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { cookies, headers } from "next/headers";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ✅ BigInt-safe JSON
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

export async function GET() {
  try {
    const auth = headers().get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cookieToken = cookies().get("session")?.value || "";

    const rawToken = bearer || cookieToken;

    if (!rawToken) {
      return json({ ok: false, error: "NO_SESSION" }, { status: 401 });
    }

    const tokenHash = sha256hex(rawToken);

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
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
