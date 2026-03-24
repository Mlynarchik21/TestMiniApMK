import { NextResponse } from "next/server";
import { runEngineTick } from "@/lib/bot/runEngineTick";
import { runManage } from "@/lib/bot/runManage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET_NOT_SET" },
      { status: 500 }
    );
  }

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const manageResult = await runManage();
    const engineResult = await runEngineTick();

    return NextResponse.json({
      ok: true,
      manage: manageResult,
      engine: engineResult,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "CRON_RUN_FAILED",
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
