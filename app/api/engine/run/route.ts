import { NextResponse } from "next/server";
import crypto from "crypto";
import { runEngineTick } from "@/lib/engine/runEngineTick";
import { runManage } from "@/lib/engine/runManage";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  // SECURITY: Требуем CRON_SECRET обязательно (не опционально)
  if (!cronSecret) {
    console.error("CRON_SECRET not configured - endpoint is protected");
    return false;
  }

  const authHeader = req.headers.get("authorization") || "";

  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (bearer.length < 16 || bearer.length !== cronSecret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(cronSecret));
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