// app/api/keys/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { encrypt } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

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

const EXCHANGES = new Set(["BINANCE", "BYBIT", "OKX"]);

export async function GET() {
  try {
    const { user } = await requireUser();

    const items = await prisma.userKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, exchange: true, label: true, createdAt: true, updatedAt: true },
    });

    return json({ ok: true, items });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();

    const body = await req.json().catch(() => null);

    const exchange = typeof body?.exchange === "string" ? body.exchange : "";
    if (!EXCHANGES.has(exchange)) {
      return json({ ok: false, error: "BAD_EXCHANGE" }, { status: 400 });
    }

    // ВАЖНО: при @@unique([userId, exchange, label]) лучше НЕ оставлять label=null
    const labelRaw = typeof body?.label === "string" ? body.label.trim() : "";
    const label = labelRaw || "Main";

    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    const apiSecret = typeof body?.apiSecret === "string" ? body.apiSecret.trim() : "";
    const passphrase = typeof body?.passphrase === "string" ? body.passphrase.trim() : "";

    if (!apiKey || !apiSecret) {
      return json({ ok: false, error: "NO_CREDENTIALS" }, { status: 400 });
    }

    const apiKeyEnc = encrypt(apiKey);
    const apiSecretEnc = encrypt(apiSecret);
    const passphraseEnc = passphrase ? encrypt(passphrase) : null;

    const item = await prisma.userKey.upsert({
      // Prisma input имя для @@unique([userId, exchange, label]):
      where: { userId_exchange_label: { userId: user.id, exchange: exchange as any, label } },
      create: { userId: user.id, exchange: exchange as any, label, apiKeyEnc, apiSecretEnc, passphraseEnc },
      update: { apiKeyEnc, apiSecretEnc, passphraseEnc },
      select: { id: true, exchange: true, label: true, createdAt: true, updatedAt: true },
    });

    return json({ ok: true, item });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
