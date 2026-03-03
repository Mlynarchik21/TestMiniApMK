// lib/auth/requireUser.ts
import crypto from "crypto";
import { headers as nextHeaders, cookies as nextCookies } from "next/headers";
import { prisma } from "@/lib/db";

type AuthedUser = {
  id: string;
  tgId: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function unauthorized(msg = "UNAUTHORIZED") {
  const err = new Error(msg);
  // @ts-expect-error attach status
  err.status = 401;
  return err;
}

function getCookieFromHeader(cookieHeader: string, name: string) {
  const m = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((p) => p.startsWith(name + "="));
  return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : "";
}

/**
 * requireUser(req?)
 * token source:
 * 1) Authorization: Bearer <rawToken>
 * 2) cookie "session"
 */
export async function requireUser(req?: Request): Promise<AuthedUser> {
  let rawToken = "";

  if (req) {
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cookieHeader = req.headers.get("cookie") || "";
    const cookieToken = getCookieFromHeader(cookieHeader, "session");
    rawToken = bearer || cookieToken;
  } else {
    const auth = nextHeaders().get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cookieToken = nextCookies().get("session")?.value || "";
    rawToken = bearer || cookieToken;
  }

  if (!rawToken) throw unauthorized("UNAUTHORIZED");

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) throw unauthorized("UNAUTHORIZED");

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    throw unauthorized("SESSION_EXPIRED");
  }

  return session.user as AuthedUser;
}
