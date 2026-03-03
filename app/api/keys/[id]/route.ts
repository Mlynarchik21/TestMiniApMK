// app/api/keys/[id]/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

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

async function getAuthedUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  const cookieHeader = req.headers.get("cookie") || "";
  const cookieToken =
    cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((p) => p.startsWith("session="))
      ?.split("=")[1] || "";

  const rawToken = bearer || cookieToken;
  if (!rawToken) return null;

  const tokenHash = sha256hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const id = String(ctx.params?.id || "").trim();
    if (!id) {
      return json({ ok: false, error: "bad_id" }, { status: 400 });
    }

    const result = await prisma.userKey.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return json({ ok: true });
  } catch (e: any) {
    return json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
