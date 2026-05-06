import { NextResponse } from "next/server";
import crypto from "crypto";
import { runEngineTick } from "@/lib/engine/runEngineTick";
import { runManage } from "@/lib/engine/runManage";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro: до 60 сек на CRON

async function sendTelegramHeartbeat(text: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || "";

    if (!botToken || !chatId) {
      return {
        ok: false,
        skipped: true,
        reason: "TELEGRAM_ENV_MISSING",
      };
    }

    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      cache: "no-store",
    });

    const raw = await r.text();

    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {}

    if (!r.ok || json?.ok === false) {
      return {
        ok: false,
        skipped: false,
        reason: "TELEGRAM_SEND_FAILED",
        status: r.status,
        response: json ?? raw,
      };
    }

    return {
      ok: true,
      skipped: false,
    };
  } catch (e: any) {
    return {
      ok: false,
      skipped: false,
      reason: "TELEGRAM_SEND_ERROR",
      message: e?.message ?? String(e),
    };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const test = url.searchParams.get("test") === "1";

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET_NOT_SET" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const secretsMatch =
    bearer.length === cronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(cronSecret));

  if (!secretsMatch) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  let manageResult: any = null;
  let engineResult: any = null;
  let manageError: string | null = null;
  let engineError: string | null = null;

  try {
    manageResult = await runManage();
  } catch (e: any) {
    manageError = e?.message ?? String(e);
  }

  try {
    engineResult = await runEngineTick();
  } catch (e: any) {
    engineError = e?.message ?? String(e);
  }

  const finishedAt = new Date().toISOString();

  let heartbeat: any = null;

  if (test) {
    heartbeat = await sendTelegramHeartbeat(
      [
        "🟢 TEST CRON OK",
        "",
        `Started: ${startedAt}`,
        `Finished: ${finishedAt}`,
        `Manage: ${manageError ? "ERROR" : "OK"}`,
        `Engine: ${engineError ? "ERROR" : "OK"}`,
      ].join("\n")
    );
  }

  const success = !manageError && !engineError;

  return NextResponse.json(
    {
      ok: success,
      startedAt,
      finishedAt,
      manage: {
        ok: !manageError,
        error: manageError,
        result: manageResult,
      },
      engine: {
        ok: !engineError,
        error: engineError,
        result: engineResult,
      },
      heartbeat,
    },
    { status: success ? 200 : 500 }
  );
}