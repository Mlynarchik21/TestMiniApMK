// app/api/keys/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
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

function normalizeLabel(label: unknown): string | null {
  if (typeof label !== "string") return null;
  const v = label.trim();
  return v.length ? v.slice(0, 64) : null;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

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
    const user = await requireUser(req);

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;

    if (!body?.exchange) return fail(400, "BAD_REQUEST", "exchange required");
    if (!body?.apiKey) return fail(400, "BAD_REQUEST", "apiKey required");
    if (!body?.apiSecret) return fail(400, "BAD_REQUEST", "apiSecret required");

    const label = normalizeLabel(body.label);

    // unique у тебя: @@unique([userId, exchange, label])
    const existing = await prisma.userKey.findFirst({
      where: {
        userId: user.id,
        exchange: body.exchange,
        label,
      },
      select: { id: true },
    });

    // ✅ Пишем в РЕАЛЬНЫЕ NOT NULL колонки БД: apiKey + secretEnc
    // + дублируем в legacy nullable колонки apiKeyEnc/apiSecretEnc (если они есть в схеме Prisma)
    const apiKeyEncrypted = encryptString(body.apiKey);
    const apiSecretEncrypted = encryptString(body.apiSecret);
    const passphraseEncrypted = body.passphrase ? encryptString(body.passphrase) : null;

    const dataEncrypted = {
      // актуальные поля (NOT NULL)
      apiKey: apiKeyEncrypted,
      secretEnc: apiSecretEncrypted,
      passphraseEnc: passphraseEncrypted,

      // legacy поля (nullable) — пусть тоже заполняются
      apiKeyEnc: apiKeyEncrypted,
      apiSecretEnc: apiSecretEncrypted,
    };

    const selectPublic = {
      id: true,
      exchange: true,
      label: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    const row = existing
      ? await prisma.userKey.update({
          where: { id: existing.id },
          data: dataEncrypted,
          select: selectPublic,
        })
      : await prisma.userKey.create({
          data: {
            ...dataEncrypted,
            exchange: body.exchange,
            label,
            // ✅ ВАЖНО: через relation connect (иначе в некоторых схемах userId становится never)
            user: { connect: { id: user.id } },
          },
          select: selectPublic,
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
