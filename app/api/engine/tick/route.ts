import { NextResponse } from "next/server";
import { runEngineTick } from "@/lib/engine/runEngineTick";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // SECURITY: Требуем аутентификации для запуска engine tick
    await requireUser(req);

    const data = await runEngineTick();
    return NextResponse.json(data);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "ENGINE_TICK_ERROR",
        message: status === 401 ? "Authentication required" : String(e?.message || e),
      },
      { status }
    );
  }
}

export async function POST(req: Request) {
  try {
    // SECURITY: Требуем аутентификации для запуска engine tick
    await requireUser(req);

    const data = await runEngineTick();
    return NextResponse.json(data);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "ENGINE_TICK_ERROR",
        message: status === 401 ? "Authentication required" : String(e?.message || e),
      },
      { status }
    );
  }
}