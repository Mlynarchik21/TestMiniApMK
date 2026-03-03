// lib/auth/requireUser.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { headers as nextHeaders, cookies as nextCookies } from "next/headers";

export const runtime = "nodejs";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function unauthorized(message = "UNAUTHORIZED") {
  const err = new Error(message);
  // @ts-expect-error attach status
  err.status = 401;
  return err;
}

function getCookieFromHeader(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";").map((s) => s.trim());
  const found = parts.find((p) => p.startsWith(name + "="));
  if (!found) return "";
  return decodeURIComponent(found.slice(name.length + 1));
}

/**
 * requireUser(req?)
 * Берёт raw token:
 * - Authorization: Bearer <rawToken>
 * - cookie "session"
 * Хэширует -> ищет Session.token (= sha256(rawToken))
 * Возвращает Prisma User
 */
export async function requireUser(req?: Request) {
  // 1) read raw token from req OR next/headers
  let auth = "";
  let cookieToken = "";

  if (req) {
    auth = req.headers.get("authorization") || "";
    cookieToken = getCookieFromHeader(req.headers.get("cookie"), "session");
  } else {
    // fallback for server components / route handlers that call without req
    auth = nextHeaders().get("authorization") || "";
    cookieToken = nextCookies().get("session")?.value || "";
  }

  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const rawToken = bearer || cookieToken;

  if (!rawToken) throw unauthorized("UNAUTHORIZED: no session token");

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session?.user) throw unauthorized("UNAUTHORIZED: invalid session");

  // expiresAt (если есть в модели Session)
  const expiresAt: Date | undefined = (session as any).expiresAt;
  if (expiresAt instanceof Date && expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    throw unauthorized("UNAUTHORIZED: session expired");
  }

  return session.user;
}
