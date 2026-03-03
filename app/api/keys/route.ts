// app/api/keys/route.ts
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

// BigInt-safe JSON
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

function ok(data: any) {
  return json({ ok: true, ...data });
}

function fail(status: number, error: string, message?: string) {
  return json({ ok: false, error, ...(message ? { message } : {}) }, { status });
}

export async function GET(req: Request) {
  try {
    const { user } = await requireUser(req);

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
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUser(req);

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;

    if (!body?.exchange) return fail(400, "BAD_REQUEST", "exchange required");
    if (!body?.apiKey) return fail(400, "BAD_REQUEST", "apiKey required");
    if (!body?.apiSecret) return fail(400, "BAD_REQUEST", "apiSecret required");

    const label =
      typeof body.label === "string" && body.label.trim().length
        ? body.label.trim().slice(0, 64)
        : null;

    // Находим запись по (userId, exchange, label) и обновляем/создаём
    const existing = await prisma.userKey.findFirst({
      where: { userId: user.id, exchange: body.exchange, label },
      select: { id: true },
    });

    // ✅ ВАЖНО: Prisma ожидает эти поля (apiKeyEnc/apiSecretEnc/passphraseEnc)
    const enc = {
      apiKeyEnc: encryptString(body.apiKey),
      apiSecretEnc: encryptString(body.apiSecret),
      passphraseEnc: body.passphrase ? encryptString(body.passphrase) : null,
    };

    const row = existing
      ? await prisma.userKey.update({
          where: { id: existing.id },
          data: enc,
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
            ...enc,
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
    return fail(status, status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", e?.message ?? String(e));
  }
}
