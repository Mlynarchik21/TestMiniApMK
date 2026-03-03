// app/api/keys/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
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

function sha256hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// BigInt-safe JSON (на будущее, единый стиль)
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

async function getAuthedUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  // если у тебя в miniapp токен идёт всегда Bearer — этого хватит.
  // но на всякий случай поддержим cookie (как в /api/settings)
  const cookieHeader = req.headers.get("cookie") || "";
  const cookieToken =
    cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((p) => p.startsWith("session="))
      ?.split("=")[1] || "";

  const rawToken = bearer || cookieToken;
  if (!rawToken) return null;

  const tokenHash = sha256hex(rawToken);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session || !session.user) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token: tokenHash } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

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
    return json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;

    if (!body?.exchange)
      return json({ ok: false, error: "exchange required" }, { status: 400 });
    if (!body?.apiKey)
      return json({ ok: false, error: "apiKey required" }, { status: 400 });
    if (!body?.apiSecret)
      return json({ ok: false, error: "apiSecret required" }, { status: 400 });

    const apiKeyEnc = encryptString(body.apiKey);
    const apiSecretEnc = encryptString(body.apiSecret);
    const passphraseEnc = body.passphrase ? encryptString(body.passphrase) : null;

    try {
      const row = await prisma.userKey.create({
        data: {
          userId: user.id,
          exchange: body.exchange,
          label: body.label ?? null,
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

      return json({ ok: true, key: row });
    } catch (e: any) {
      // Prisma unique violation -> понятная ошибка
      if (e?.code === "P2002") {
        return json({ ok: false, error: "ALREADY_EXISTS" }, { status: 409 });
      }
      throw e;
    }
  } catch (e: any) {
    return json(
      { ok: false, error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
