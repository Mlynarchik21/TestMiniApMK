// lib/auth/requireUser.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";

export type AuthedUser = {
  id: string;
  tgId: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function getCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((s) => s.trim());
  const hit = parts.find((p) => p.startsWith(name + "="));
  if (!hit) return "";
  return decodeURIComponent(hit.slice(name.length + 1));
}

function unauthorized(message = "UNAUTHORIZED") {
  const e = new Error(message);
  // @ts-expect-error attach status
  e.status = 401;
  throw e;
}

/**
 * requireUser(req)
 * Sources:
 * - Authorization: Bearer <rawToken>
 * - Cookie: session=<rawToken>
 *
 * DB stores sha256(rawToken) in Session.token
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  const cookieHeader = req.headers.get("cookie") || "";
  const cookieToken = getCookie(cookieHeader, "session");

  const rawToken = bearer || cookieToken;
  if (!rawToken) unauthorized("UNAUTHORIZED");

  const tokenHash = sha256hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) unauthorized("UNAUTHORIZED");

  // expiresAt у тебя есть в модели Session
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    unauthorized("UNAUTHORIZED");
  }

  return session.user;
}
