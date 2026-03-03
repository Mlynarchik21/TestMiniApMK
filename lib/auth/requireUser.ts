// lib/auth/requireUser.ts
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";

type AuthedError = Error & { status?: number };

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function unauthorized(message = "UNAUTHORIZED") {
  const e: AuthedError = new Error(message);
  e.status = 401;
  return e;
}

/**
 * requireUser()
 * Источник токена:
 * 1) Authorization: Bearer <rawToken>
 * 2) cookie "session" (fallback)
 *
 * В БД Session.token хранит sha256(rawToken)
 */
export async function requireUser() {
  const h = headers();
  const auth = h.get("authorization") || "";

  const bearerToken = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  const cookieToken = cookies().get("session")?.value?.trim() || "";

  const rawToken = bearerToken || cookieToken;
  if (!rawToken) throw unauthorized("UNAUTHORIZED: no token");

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findFirst({
    where: {
      token: tokenHash,
      // если поле expiresAt есть в модели — это отфильтрует протухшие сессии
      ...(typeof (prisma as any).session?.fields?.expiresAt !== "undefined"
        ? { expiresAt: { gt: new Date() } }
        : {}),
    } as any,
    include: { user: true },
  });

  if (!session?.user) throw unauthorized("UNAUTHORIZED: invalid session");

  // если expiresAt есть, но запрос выше не смог его применить (редкий случай) — проверим вручную
  const expiresAt: Date | undefined = (session as any).expiresAt;
  if (expiresAt instanceof Date && expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    throw unauthorized("UNAUTHORIZED: session expired");
  }

  return session.user;
}
