import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function callInternal(path: string, method: "GET" | "POST" = "GET") {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const normalizedBase =
    baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
      ? baseUrl
      : `https://${baseUrl}`;

  const res = await fetch(`${normalizedBase}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
  });

  const text = await res.text();

  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = {
      ok: false,
      error: "BAD_JSON",
      raw: text,
    };
  }

  return {
    httpStatus: res.status,
    ok: res.ok,
    json,
  };
}

export async function GET() {
  try {
    const tick = await callInternal("/api/engine/tick", "GET");
    const manage = await callInternal("/api/engine/manage", "GET");

    return NextResponse.json({
      ok: true,
      engine: {
        tick,
        manage,
      },
    });
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
    const tick = await callInternal("/api/engine/tick", "POST");
    const manage = await callInternal("/api/engine/manage", "POST");

    return NextResponse.json({
      ok: true,
      engine: {
        tick,
        manage,
      },
    });
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