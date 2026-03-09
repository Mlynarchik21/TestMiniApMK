// lib/auth.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getRawToken(req: Request) {
  const auth = req.headers.get("authorization") || "";

  if (auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }

  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);

  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return "";
}

export async function getAuthUser(req: Request) {
  const rawToken = getRawToken(req);
  if (!rawToken) return null;

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  return session.user;
}