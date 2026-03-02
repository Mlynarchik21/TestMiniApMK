import { NextResponse } from "next/server";

export const runtime = "nodejs";

function maskUrl(u: string) {
  try {
    const url = new URL(u);
    // прячем пароль
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "invalid_url";
  }
}

export async function GET() {
  const raw = process.env.DATABASE_URL || "";
  let host = "";
  let port = "";
  let user = "";
  try {
    const u = new URL(raw);
    host = u.hostname;
    port = u.port;
    user = u.username;
  } catch {}

  return NextResponse.json({
    ok: true,
    vercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || null, // production / preview / development
    nodeEnv: process.env.NODE_ENV || null,
    databaseUrlMasked: raw ? maskUrl(raw) : null,
    databaseHost: host || null,
    databasePort: port || null,
    databaseUser: user || null,
  });
}
