// app/api/logout/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

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

export async function POST(req: Request) {
  try {
    const rawToken = getRawToken(req);

    if (rawToken) {
      const tokenHash = sha256Hex(rawToken);

      await prisma.session.deleteMany({
        where: { token: tokenHash },
      });
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set("session", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}