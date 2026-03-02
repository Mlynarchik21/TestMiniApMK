import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptString } from "@/lib/crypto/secretBox";
import { Exchange } from "@prisma/client";

type CreateBody = {
  exchange: Exchange;
  label?: string | null;
  apiKey: string;
  apiSecret: string;
  passphrase?: string | null;
};

export async function GET() {
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

  return NextResponse.json({ ok: true, keys: rows });
}

export async function POST(req: Request) {
  const user = await requireUser();

  const body = (await req.json()) as Partial<CreateBody>;
  if (!body.exchange)
    return NextResponse.json({ ok: false, error: "exchange required" }, { status: 400 });
  if (!body.apiKey)
    return NextResponse.json({ ok: false, error: "apiKey required" }, { status: 400 });
  if (!body.apiSecret)
    return NextResponse.json({ ok: false, error: "apiSecret required" }, { status: 400 });

  const row = await prisma.userKey.create({
    data: {
      userId: user.id,
      exchange: body.exchange,
      label: body.label ?? null,
      apiKeyEnc: encryptString(body.apiKey),
      apiSecretEnc: encryptString(body.apiSecret),
      passphraseEnc: body.passphrase ? encryptString(body.passphrase) : null,
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
}
