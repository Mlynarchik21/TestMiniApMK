// lib/auth/requireUser.ts
import crypto from "crypto";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

type RequireUserResult = {
  user: {
    id: string;
    tgId: string;
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
    createdAt?: Date;
  };
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function unauthorized(msg: string) {
  const err = new Error(msg);
  // @ts-expect-error attach status
  err.status = 401;
  return err;
}

/**
 * requireUser()
 * Источник токена:
 * 1) Authorization: Bearer <rawToken>
 * 2) cookie "session" (fallback)
 */
export async function requireUser(): Promise<RequireUserResult> {
  const auth = headers().get("authorization") || "";
  const bearerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieToken = cookies().get("session")?.value || "";

  const rawToken = bearerToken || cookieToken;
  if (!rawToken) throw unauthorized("UNAUTHORIZED: no bearer token and no cookie");

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) throw unauthorized("UNAUTHORIZED: invalid session");

  // expiresAt — опционально (если есть в модели)
  const expiresAt: Date | undefined = (session as any).expiresAt;
  if (expiresAt instanceof Date && expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    throw unauthorized("UNAUTHORIZED: session expired");
  }

  return {
    user: {
      id: session.user.id,
      tgId: session.user.tgId,
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    },
    session: {
      id: session.id,
      userId: session.userId,
      token: session.token,
      createdAt: (session as any).createdAt,
    },
  };
}
