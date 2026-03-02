// lib/auth/requireUser.ts
import { cookies } from "next/headers";
import crypto from "crypto";
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
    createdAt?: Date; // оставляем опционально (если есть в модели)
  };
};

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * requireUser()
 * - читает HttpOnly cookie "session" (raw token)
 * - sha256(raw) -> ищет Session по Session.token
 * - подтягивает User
 * - если нет -> кидает ошибку 401
 */
export async function requireUser(): Promise<RequireUserResult> {
  const rawSession = cookies().get("session")?.value;

  if (!rawSession) {
    const err = new Error("UNAUTHORIZED: missing session cookie");
    // @ts-expect-error attach status
    err.status = 401;
    throw err;
  }

  const tokenHash = sha256Hex(rawSession);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) {
    const err = new Error("UNAUTHORIZED: invalid session");
    // @ts-expect-error attach status
    err.status = 401;
    throw err;
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
      createdAt: (session as any).createdAt, // если поля нет — будет undefined, TS не упадёт
    },
  };
}
