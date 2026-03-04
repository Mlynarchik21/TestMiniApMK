// app/api/balance/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
// если у тебя есть decryptString — используй его
import { decryptString } from "@/lib/crypto/secretBox";

export const runtime = "nodejs";

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

function hmacSha256Hex(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function binanceSpotBalances(apiKey: string, apiSecret: string) {
  const baseUrl = process.env.BINANCE_BASE_URL || "https://api.binance.com";
  const timestamp = Date.now();

  const qs = new URLSearchParams({
    timestamp: String(timestamp),
    recvWindow: "5000",
  });

  const signature = hmacSha256Hex(apiSecret, qs.toString());
  qs.set("signature", signature);

  const url = `${baseUrl}/api/v3/account?${qs.toString()}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-MBX-APIKEY": apiKey,
    },
    cache: "no-store",
  });

  const text = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!r.ok) {
    return {
      ok: false as const,
      status: r.status,
      error: j?.msg || text || "Binance error",
      raw: j ?? text,
    };
  }

  const balancesRaw = Array.isArray(j?.balances) ? j.balances : [];
  const balances = balancesRaw
    .map((b: any) => ({
      asset: String(b.asset),
      free: String(b.free),
      locked: String(b.locked),
    }))
    .filter((b: any) => {
      const free = Number(b.free);
      const locked = Number(b.locked);
      return (Number.isFinite(free) && free !== 0) || (Number.isFinite(locked) && locked !== 0);
    });

  return { ok: true as const, balances };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = String(url.searchParams.get("keyId") || "").trim();
    if (!keyId) return json({ ok: false, error: "BAD_REQUEST", message: "keyId required" }, { status: 400 });

    const key = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,

        // ⚠️ ВАЖНО:
        // Подставь реальные поля твоей таблицы.
        // Судя по твоему скрину с Supabase: apiKey, secretEnc, passphraseEnc
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,

        // если у тебя где-то остались legacy поля — можно не трогать
        // apiKeyEnc: true,
        // apiSecretEnc: true,
      } as any,
    });

    if (!key) return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    if (key.exchange !== "BINANCE") {
      return json(
        { ok: false, error: "NOT_SUPPORTED_YET", message: `exchange ${key.exchange} not implemented` },
        { status: 400 }
      );
    }

    // ключи в БД у тебя сейчас лежат как ЗАШИФРОВАННЫЕ строки
    // если внезапно хранятся нешифрованными — decryptString упадет, поэтому делаем fallback
    const apiKeyRaw = String((key as any).apiKey || "");
    const apiSecretRaw = String((key as any).secretEnc || "");

    let apiKey = apiKeyRaw;
    let apiSecret = apiSecretRaw;

    try {
      apiKey = decryptString(apiKeyRaw);
    } catch {
      // fallback: возможно ключ уже raw
    }
    try {
      apiSecret = decryptString(apiSecretRaw);
    } catch {
      // fallback
    }

    if (!apiKey || !apiSecret) {
      return json(
        { ok: false, error: "BAD_KEY", message: "apiKey/apiSecret missing after decrypt" },
        { status: 400 }
      );
    }

    const res = await binanceSpotBalances(apiKey, apiSecret);
    if (!res.ok) {
      return json(
        { ok: false, error: "EXCHANGE_ERROR", exchange: "BINANCE", details: res },
        { status: 400 }
      );
    }

    return json({
      ok: true,
      exchange: "BINANCE",
      keyId: key.id,
      balances: res.balances,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
