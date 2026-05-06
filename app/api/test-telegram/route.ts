import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // SECURITY: По default требуем аутентификацию для test endpoint
    // Можно разрешить через ENABLE_TEST_ENDPOINTS=true
    const enableTestEndpoints = process.env.ENABLE_TEST_ENDPOINTS === "true";
    
    if (!enableTestEndpoints) {
      // Требуем авторизацию если test endpoints отключены (default)
      await requireUser(req);
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";

    const user = await prisma.user.findFirst({
      where: { username: "KMlynarchik" },
      select: {
        id: true,
        tgId: true,
        username: true,
      },
    });

    if (!botToken) {
      return NextResponse.json({
        ok: false,
        step: "ENV_CHECK",
        error: "TELEGRAM_BOT_TOKEN_MISSING",
      });
    }

    if (!user?.tgId) {
      return NextResponse.json({
        ok: false,
        step: "USER_CHECK",
        error: "TG_ID_MISSING",
        user,
      });
    }

    const text =
      `Тест Telegram\n\n` +
      `userId: ${user.id}\n` +
      `tgId: ${user.tgId}\n` +
      `username: ${user.username ?? "-"}\n` +
      `time: ${new Date().toISOString()}`;

    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: String(user.tgId),
        text,
      }),
      cache: "no-store",
    });

    const rawText = await r.text();

    let json: any = null;
    try {
      json = JSON.parse(rawText);
    } catch {}

    return NextResponse.json({
      ok: r.ok,
      httpStatus: r.status,
      envTokenExists: !!botToken,
      envTokenPreview: `${botToken.slice(0, 8)}...${botToken.slice(-6)}`,
      user,
      telegramResponse: json ?? rawText,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return NextResponse.json(
      {
        ok: false,
        error: status === 401 ? "UNAUTHORIZED" : "ERROR",
        message: status === 401 ? "Authentication required" : String(e?.message || e),
      },
      { status }
    );
  }
}