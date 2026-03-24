import { NextResponse } from "next/server";
import { runEngineTick } from "@/lib/...."; // путь к функции
import { runManage } from "@/lib/....";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await runManage();
    await runEngineTick();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
    });
  }
}
