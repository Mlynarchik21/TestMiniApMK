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

function json(data: any, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
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

    return json({ ok: true, keys: rows });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message },
      { status }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;

    if (!body?.exchange) return json({ ok: false, error: "exchange required" }, { status: 400 });
    if (!body?.apiKey) return json({ ok: false, error: "apiKey required" }, { status: 400 });
    if (!body?.apiSecret) return json({ ok: false, error: "apiSecret required" }, { status: 400 });

    // ВАЖНО: записываем так, как у тебя сейчас в базе:
    // apiKey (plain) + secretEnc (encrypt(apiSecret)) + passphraseEnc (optional)
    const row = await prisma.userKey.create({
      data: {
        userId: user.id,
        exchange: body.exchange,
        label: body.label ?? null,
        apiKey: String(body.apiKey),
        secretEnc: encryptString(String(body.apiSecret)),
        passphraseEnc: body.passphrase ? encryptString(String(body.passphrase)) : null,
      },
      select: {
        id: true,
        exchange: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return json({ ok: true, key: row });
  } catch (e: any) {
    return json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
