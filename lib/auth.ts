// lib/auth.ts
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./db";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function requireUser() {
  const sessionToken = cookies().get("session")?.value;
  if (!sessionToken) return null;

  const tokenHash = sha256hex(sessionToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  // если сессия протухла — удаляем и говорим "нет сессии"
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
    return null;
  }

  return session.user;
}