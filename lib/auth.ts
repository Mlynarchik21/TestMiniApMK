import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function requireUser() {
  const token = cookies().get("session")?.value;
  if (!token) return null;

  const tokenHash = sha256hex(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
    return null;
  }

  return session.user;
}
