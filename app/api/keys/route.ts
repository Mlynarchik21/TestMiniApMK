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

    const label =
      typeof body.label === "string" && body.label.trim().length
        ? body.label.trim().slice(0, 64)
        : null;

    // ВАЖНО: имена полей должны совпадать с твоей моделью UserKey в prisma/schema.prisma
    // Судя по твоим логам/коду сейчас это: apiKey, secretEnc, passphraseEnc
    const payload = {
      apiKey: encryptString(body.apiKey),
      secretEnc: encryptString(body.apiSecret),
      passphraseEnc: body.passphrase ? encryptString(body.passphrase) : null,
    };

    // “upsert” делаем вручную по (userId, exchange, label)
    const existing = await prisma.userKey.findFirst({
      where: { userId: user.id, exchange: body.exchange, label },
      select: { id: true },
    });

    if (existing) {
      const row = await prisma.userKey.update({
        where: { id: existing.id },
        data: payload as any, // ✅ снимаем Prisma TS-конфликт
        select: {
          id: true,
          exchange: true,
          label: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return ok({ key: row, updated: true });
    }

    const row = await prisma.userKey.create({
      data: {
        // ✅ связь через connect (и одновременно не даём Prisma типам упасть)
        user: { connect: { id: user.id } },
        exchange: body.exchange,
        label,
        ...payload,
      } as any, // ✅ снимаем Prisma TS-конфликт
      select: {
        id: true,
        exchange: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return ok({ key: row, created: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}
