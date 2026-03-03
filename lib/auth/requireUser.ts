// lib/auth/requireUser.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";

type RequireUserResult = {
  user: {
    id: string;
    tgId: bigint | string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  };
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt?: Date;
    createdAt?: Date;
  };
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function unauthorized(msg = "UNAUTHORIZED") {
  const err = new Error(msg);
  // @ts-expect-error
  err.status = 401;
  return err;
}

function getCookieValue(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((s) => s.trim());
  const hit = parts.find((p) => p.startsWith(name + "="));
  if (!hit) return "";
  return decodeURIComponent(hit.slice(name.length + 1));
}

/**
 * requireUser(req)
 * Token sources:
 * 1) Authorization: Bearer <rawToken>
 * 2) Cookie: session=<rawToken>
 *
 * В БД Session.token хранит sha256(rawToken)
 */
export async function requireUser(req: Request): Promise<RequireUserResult> {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  const cookieHeader = req.headers.get("cookie") || "";
  const cookieToken = getCookieValue(cookieHeader, "session");

  const rawToken = bearer || cookieToken;
  if (!rawToken) throw unauthorized("UNAUTHORIZED");

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) throw unauthorized("UNAUTHORIZED");

  // expiresAt есть у тебя в модели Session
  const expiresAt = (session as any).expiresAt as Date | undefined;
  if (expiresAt instanceof Date && expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    throw unauthorized("SESSION_EXPIRED");
  }

  return {
    user: {
      id: session.user.id,
      tgId: session.user.tgId,
      username: session.user.username ?? null,
      firstName: session.user.firstName ?? null,
      lastName: session.user.lastName ?? null,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    },
    session: {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt,
      createdAt: (session as any).createdAt,
    },
  };
}
