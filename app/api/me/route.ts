// app/api/me/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        tgId: user.tgId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;

    return NextResponse.json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR" },
      { status }
    );
  }
}
