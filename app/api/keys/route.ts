// app/api/keys/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { encryptSecret } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

function maskKey(s: string) {
  if (!s) return "";
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export async function GET() {
  try {
    const { user } = await requireUser();

    const rows = await prisma.userKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        exchange: true,
        label: true,
        apiKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      keys: rows.map((r) => ({
        ...r,
        apiKeyMasked: maskKey(r.apiKey),
        apiKey: undefined, // не возвращаем полностью
      })),
    });
  } catch (e: any) {
    const status = (e as any)?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "ERROR" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();

    const body = await req.json().catch(() => null);

    const exchange = String(body?.exchange || "").toUpperCase();
    const label = typeof body?.label === "string" ? body.label : null;

    const apiKey = String(body?.apiKey || "").trim();
    const apiSecret = String(body?.apiSecret || "").trim();
    const passphrase = body?.passphrase != null ? String(body.passphrase).trim() : "";

    if (!exchange) return NextResponse.json({ ok: false, error: "exchange required" }, { status: 400 });
    if (!apiKey) return NextResponse.json({ ok: false, error: "apiKey required" }, { status: 400 });
    if (!apiSecret) return NextResponse.json({ ok: false, error: "apiSecret required" }, { status: 400 });

    // валидируем enum мягко
    const allowed = ["BINANCE", "BYBIT", "OKX"];
    if (!allowed.includes(exchange)) {
      return NextResponse.json({ ok: false, error: "exchange must be BINANCE|BYBIT|OKX" }, { status: 400 });
    }

    const secretEnc = encryptSecret(apiSecret);
    const passphraseEnc = passphrase ? encryptSecret(passphrase) : null;

    const created = await prisma.userKey.create({
      data: {
        userId: user.id,
        exchange: exchange as any,
        label,
        apiKey,
        secretEnc,
        passphraseEnc,
      },
      select: {
        id: true,
        exchange: true,
        label: true,
        apiKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      key: {
        ...created,
        apiKeyMasked: maskKey(created.apiKey),
        apiKey: undefined,
      },
    });
  } catch (e: any) {
    const status = (e as any)?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "ERROR" }, { status });
  }
}
