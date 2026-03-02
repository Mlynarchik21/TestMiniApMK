import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { encryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

// GET /api/keys -> список ключей (без секретов)
export async function GET() {
  try {
    const { user } = await requireUser();

    const keys = await prisma.userKey.findMany({
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

    return NextResponse.json({ ok: true, keys });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status });
  }
}

// POST /api/keys -> создать ключ
// body: { exchange, label?, apiKey, apiSecret, passphrase? }
export async function POST(req: Request) {
  try {
    const { user } = await requireUser();

    const body = await req.json().catch(() => null);
    const exchange = String(body?.exchange || "").trim();
    const label = body?.label != null ? String(body.label).trim() : null;

    const apiKey = String(body?.apiKey || "").trim();
    const apiSecret = String(body?.apiSecret || "").trim();
    const passphrase = body?.passphrase != null ? String(body.passphrase).trim() : "";

    if (!exchange) {
      return NextResponse.json({ ok: false, error: "exchange_required" }, { status: 400 });
    }
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, error: "apiKey_apiSecret_required" }, { status: 400 });
    }

    const row = await prisma.userKey.create({
      data: {
        userId: user.id,
        exchange,
        label,
        apiKeyEnc: encryptString(apiKey),
        apiSecretEnc: encryptString(apiSecret),
        passphraseEnc: passphrase ? encryptString(passphrase) : null,
      },
      select: {
        id: true,
        exchange: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, key: row });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status });
  }
}
