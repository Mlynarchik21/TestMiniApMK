// lib/auth/requireUser.ts
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";

export type AuthedUser = {
  id: string;
  tgId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt?: Date;
  updatedAt?: Date;
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

function getCookieFromHeader(cookieHeader: string, name: string): string {
  if (!cookieHeader) return "";
  const part = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((p) => p.startsWith(name + "="));
  if (!part) return "";
  return decodeURIComponent(part.split("=").slice(1).join("="));
}

/**
 * requireUser(req?)
 * Источник токена:
 * - Authorization: Bearer <rawToken>
 * - cookie "session"
 *
 * Работает и в route handlers (с req), и в server components (без req).
 */
export async function requireUser(req?: Request): Promise<AuthedUser> {
  const authHeader = req
    ? req.headers.get("authorization") || ""
    : headers().get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const cookieToken = req
    ? getCookieFromHeader(req.headers.get("cookie") || "", "session")
    : cookies().get("session")?.value || "";

  const rawToken = bearerToken || cookieToken;
  if (!rawToken) throw unauthorized("UNAUTHORIZED");

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    // ✅ unique key в БД: tokenHash
    where: { tokenHash },
    include: { user: true },
  });

  if (!session?.user) throw unauthorized("UNAUTHORIZED");

  const expiresAt: Date | undefined = (session as any).expiresAt;
  if (expiresAt instanceof Date && expiresAt < new Date()) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
    throw unauthorized("UNAUTHORIZED");
  }

  return {
    id: session.user.id,
    tgId: String(session.user.tgId),
    username: session.user.username ?? null,
    firstName: session.user.firstName ?? null,
    lastName: session.user.lastName ?? null,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  };
}