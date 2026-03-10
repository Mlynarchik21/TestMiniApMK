import { NextResponse } from "next/server";
import { runEngineTick } from "@/app/api/engine/tick/route";
import { runManage } from "@/app/api/engine/manage/route";

export const runtime = "nodejs";

async function runEngine() {
  const tick = await runEngineTick();
  const manage = await runManage();

  return {
    ok: true,
    engine: {
      tick,
      manage,
    },
  };
}

export async function GET() {
  try {
    const data = await runEngine();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_RUN_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const data = await runEngine();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "ENGINE_RUN_ERROR",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}