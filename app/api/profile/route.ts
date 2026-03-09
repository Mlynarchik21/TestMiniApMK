// app/api/profile/route.ts
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

export async function GET(req: Request) {
  try {
    const rawToken = getRawToken(req);

    if (!rawToken) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const tokenHash = sha256Hex(rawToken);

    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!session) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const user = session.user;

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        tgId: user.tgId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}