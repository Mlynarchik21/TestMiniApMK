// app/api/logout/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const token = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("session="))
    ?.split("=")[1];

  if (token) {
    const tokenHash = sha256hex(token);
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });

  // удаляем cookie
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
