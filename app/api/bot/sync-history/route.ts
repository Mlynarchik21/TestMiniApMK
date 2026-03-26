import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { getExchangeAdapter } from "@/lib/exchanges";
import type { ExchangeName } from "@/lib/exchanges/types";

export const runtime = "nodejs";

type AnyJson = any;

function ok(data?: AnyJson) {
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

function fail(status: number, error: string, message?: string, extra?: AnyJson) {
  return NextResponse.json(
    { ok: false, error, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getRangeFromPreset(preset: string) {
  const now = new Date();
  const from = new Date(now);

  switch (preset) {
    case "1D":
      from.setDate(from.getDate() - 1);
      break;
    case "7D":
      from.setDate(from.getDate() - 7);
      break;
    case "30D":
      from.setDate(from.getDate() - 30);
      break;
    case "90D":
      from.setDate(from.getDate() - 90);
      break;
    default:
      from.setDate(from.getDate() - 7);
      break;
  }

  return { from, to: now };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => null)) as AnyJson | null;

    if (!body) return fail(400, "BAD_REQUEST", "JSON body required");

    const keyId = String(body.keyId || "").trim();
    if (!keyId) {
      return fail(400, "BAD_REQUEST", "keyId required");
    }

    const preset = String(body.preset || "7D").toUpperCase();
    const customFrom = parseDate(body.from);
    const customTo = parseDate(body.to);

    let from: Date;
    let to: Date;

    if (preset === "CUSTOM") {
      if (!customFrom || !customTo) {
        return fail(400, "BAD_REQUEST", "from/to required for CUSTOM");
      }
      from = customFrom;
      to = customTo;
    } else {
      const range = getRangeFromPreset(preset);
      from = range.from;
      to = range.to;
    }

    if (from >= to) {
      return fail(400, "BAD_REQUEST", "`from` must be earlier than `to`");
    }

    const key = await prisma.userKey.findFirst({
      where: {
        id: keyId,
        userId: user.id,
      },
      select: {
        id: true,
        apiKey: true,
        secretEnc: true,
        exchange: true,
        label: true,
      },
    });

    if (!key) {
      return fail(404, "KEY_NOT_FOUND", "Selected key not found");
    }

    if (key.exchange !== "BYBIT") {
      return fail(
        400,
        "UNSUPPORTED_EXCHANGE",
        "History sync currently supports BYBIT only"
      );
    }

    const exchange = getExchangeAdapter(key.exchange as ExchangeName);
    const apiSecret = decryptString(key.secretEnc);

    const closedTrades = await exchange.getClosedTrades({
      apiKey: key.apiKey,
      apiSecret,
      from,
      to,
    });

    if (!closedTrades.length) {
      return ok({
        keyId: key.id,
        exchange: key.exchange,
        synced: 0,
        skipped: 0,
        errors: 0,
        errorItems: [],
        totalFetched: 0,
        from: from.toISOString(),
        to: to.toISOString(),
      });
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    const errorItems: Array<{
      symbol: string;
      message: string;
      updatedAt: string;
    }> = [];

    for (const t of closedTrades) {
      try {
        const closedAt = new Date(t.updatedAt);
        const openedAt = new Date(t.createdAt);

        const exists = await prisma.botTrade.findFirst({
          where: {
            userId: user.id,
            symbol: t.symbol,
            closedAt: {
              gte: new Date(closedAt.getTime() - 60_000),
              lte: new Date(closedAt.getTime() + 60_000),
            },
          },
          select: { id: true },
        });

        if (exists) {
          skipped++;
          continue;
        }

        await prisma.botTrade.create({
          data: {
            userId: user.id,
            exchange: key.exchange,
            symbol: t.symbol,
            entryValue: t.quoteQty,
            exitValue: t.quoteQty,
            qty: t.qty,
            avgEntryPrice: t.avgPrice,
            exitPrice: t.avgPrice,
            pnl: 0,
            pnlPercent: 0,
            addsCount: 0,
            closeReason: "MANUAL",
            openedAt,
            closedAt,
          },
        });

        synced++;
      } catch (e: any) {
        errors++;

        if (errorItems.length < 10) {
          errorItems.push({
            symbol: String(t.symbol || ""),
            message: e?.message ?? String(e),
            updatedAt: String(t.updatedAt || ""),
          });
        }
      }
    }

    return ok({
      keyId: key.id,
      exchange: key.exchange,
      synced,
      skipped,
      errors,
      errorItems,
      totalFetched: closedTrades.length,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  } catch (e: any) {
    return fail(500, "SERVER_ERROR", e?.message ?? String(e));
  }
}