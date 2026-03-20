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
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      e?.message ?? String(e)
    );
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

    const apiKey = String(body.apiKey).trim();
    const apiSecret = String(body.apiSecret).trim();

    if (!apiKey) return fail(400, "BAD_REQUEST", "apiKey required");
    if (!apiSecret) return fail(400, "BAD_REQUEST", "apiSecret required");

    const dataEncrypted = {
      exchange: body.exchange,
      label,
      apiKey,
      secretEnc: encryptString(apiSecret),
      passphraseEnc: body.passphrase ? encryptString(String(body.passphrase).trim()) : null,
    };

    // 1) сначала ищем точное совпадение по apiKey
    const existingByApiKey = await prisma.userKey.findFirst({
      where: {
        userId: user.id,
        exchange: body.exchange,
        apiKey,
      },
      select: { id: true },
    });

    // 2) если не нашли — ищем по label, чтобы можно было обновлять старую запись
    const existingByLabel =
      !existingByApiKey && label
        ? await prisma.userKey.findFirst({
            where: {
              userId: user.id,
              exchange: body.exchange,
              label,
            },
            select: { id: true },
          })
        : null;

    const existingId = existingByApiKey?.id ?? existingByLabel?.id ?? null;

    const row = existingId
      ? await prisma.userKey.update({
          where: { id: existingId },
          data: dataEncrypted,
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
            ...dataEncrypted,
            user: { connect: { id: user.id } },
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
    const message = e?.message ?? String(e);

    if (
      message.includes("Unique constraint failed") &&
      message.includes('"userId"') &&
      message.includes('"exchange"') &&
      message.includes('"apiKey"')
    ) {
      return fail(
        400,
        "DUPLICATE_API_KEY",
        "Такой ключ для этой биржи уже сохранён. Удали старый или обнови его."
      );
    }

    const status = typeof e?.status === "number" ? e.status : 500;
    return fail(
      status,
      status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR",
      message
    );
  }
}