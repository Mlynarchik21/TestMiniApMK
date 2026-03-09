// lib/auth/requireUser.ts
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

export async function requireUser(req: Request) {
  const rawToken = getRawToken(req);

  if (!rawToken) {
    const err: any = new Error("UNAUTHORIZED");
    err.status = 401;
    throw err;
  }

  const tokenHash = sha256Hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session) {
    const err: any = new Error("UNAUTHORIZED");
    err.status = 401;
    throw err;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    const err: any = new Error("SESSION_EXPIRED");
    err.status = 401;
    throw err;
  }

  return session.user;
}