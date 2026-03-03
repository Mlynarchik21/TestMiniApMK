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

/**
 * Совместимость:
 * - requireUser() может вернуть User
 * - или { user, session }
 */
async function getUser() {
  const r: any = await requireUser();
  return r?.user ?? r;
}

export async function GET() {
  try {
    const user = await getUser();

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
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser();

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;

    if (!body?.exchange) return fail(400, "BAD_REQUEST", "exchange required");
    if (!body?.apiKey) return fail(400, "BAD_REQUEST", "apiKey required");
    if (!body?.apiSecret) return fail(400, "BAD_REQUEST", "apiSecret required");

    // label: если пусто — считаем "Main"
    const labelRaw = typeof body.label === "string" ? body.label.trim() : "";
    const label = labelRaw.length ? labelRaw : "Main";

    // encrypt
    const apiKeyEnc = encryptString(String(body.apiKey).trim());
    const apiSecretEnc = encryptString(String(body.apiSecret).trim());
    const passphraseEnc =
      body.passphrase && String(body.passphrase).trim().length
        ? encryptString(String(body.passphrase).trim())
        : null;

    // НЕ используем upsert по composite unique (имя может отличаться)
    const existing = await prisma.userKey.findFirst({
      where: {
        userId: user.id,
        exchange: body.exchange,
        label,
      },
      select: { id: true },
    });

    const row = existing
      ? await prisma.userKey.update({
          where: { id: existing.id },
          data: { apiKeyEnc, apiSecretEnc, passphraseEnc },
          select: {
            id: true,
            exchange: true,
            label: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : await prisma.userKey.create({
          data: {
            userId: user.id,
            exchange: body.exchange,
            label,
            apiKeyEnc,
            apiSecretEnc,
            passphraseEnc,
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
