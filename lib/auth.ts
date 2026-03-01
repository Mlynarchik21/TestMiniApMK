// lib/auth.ts
import { cookies } from "next/headers";
import { prisma } from "./db";

export async function requireUser() {
  const sessionToken = cookies().get("session")?.value;
  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session) return null;

  // если сессия протухла — удаляем и говорим "нет сессии"
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token: sessionToken } }).catch(() => {});
    return null;
  }

  return session.user;
}
