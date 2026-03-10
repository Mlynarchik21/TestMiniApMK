import { NextResponse } from "next/server";
import { runManage } from "@/lib/engine/runManage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await runManage();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_MANAGE_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const data = await runManage();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_MANAGE_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
