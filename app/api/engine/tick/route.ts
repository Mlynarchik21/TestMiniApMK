import { NextResponse } from "next/server";
import { runEngineTick } from "@/lib/engine/runEngineTick";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await runEngineTick();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_TICK_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const data = await runEngineTick();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_TICK_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}