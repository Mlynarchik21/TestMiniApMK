import { NextResponse } from "next/server";
import { runEngineTick } from "@/lib/engine/runEngineTick";
import { runManage } from "@/lib/engine/runManage";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  // если секрет не задан — разрешаем
  if (!cronSecret) return true;

  const authHeader = req.headers.get("authorization") || "";

  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  return bearer === cronSecret;
}

async function runEngine() {
  const tick = await runEngineTick().catch((e) => ({
    ok: false,
    error: "TICK_ERROR",
    message: String(e?.message || e),
  }));

  const manage = await runManage().catch((e) => ({
    ok: false,
    error: "MANAGE_ERROR",
    message: String(e?.message || e),
  }));

  return {
    ok: true,
    engine: {
      tick,
      manage,
    },
  };
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

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

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

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