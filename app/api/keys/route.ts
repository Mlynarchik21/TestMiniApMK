// app/api/keys/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptString } from "@/lib/crypto/secretBox";
import { Exchange } from "@prisma/client";

export const runtime = "nodejs";

type CreateBody = {
  exchange: Exchange;
  label?: string | null;
  apiKey: string;
  apiSecret: string;
  passphrase?: string | null;
};

function ok(data: any) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}) },
    { status }
  );
}

export async function GET() {
  try {
    const user = await requireUser();

    const rows = await prisma.userKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        exchange: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({ keys: rows });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;

    if (!body?.exchange) return fail(400, "exchange required");
    if (!body?.apiKey) return fail(400, "apiKey required");
    if (!body?.apiSecret) return fail(400, "apiSecret required");

    const row = await prisma.userKey.create({
      data: {
        userId: user.id,
        exchange: body.exchange,
        label: body.label ?? null,

        // БАЗА ЖДЁТ ЭТИ ПОЛЯ
        apiKey: body.apiKey,

        // Шифруем secret + passphrase в одно поле
        secretEnc: encryptString(
          JSON.stringify({
            apiSecret: body.apiSecret,
            passphrase: body.passphrase ?? null,
          })
        ),

        // это поле nullable — можем оставить
        passphraseEnc: body.passphrase
          ? encryptString(body.passphrase)
          : null,
      },
      select: {
        id: true,
        exchange: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({ key: row });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}
