// app/api/balance/route.ts
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
import { decryptString } from "@/lib/crypto/secretBox";
import { fetchBinanceBalances } from "@/lib/exchanges/binance";

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

export async function GET(req: Request) {
  try {
    // ✅ ВАЖНО: requireUser возвращает AuthedUser, НЕ { user }
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = (url.searchParams.get("keyId") || "").trim();

    if (!keyId) {
      return json({ ok: false, error: "BAD_REQUEST", message: "keyId is required" }, { status: 400 });
    }

    // берём ключ только владельца
    const key = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,
        apiKeyEnc: true,
        apiSecretEnc: true,
        passphraseEnc: true,
      },
    });

    if (!key) {
      return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // расшифровываем
    const apiKey = decryptString(key.apiKeyEnc);
    const apiSecret = decryptString(key.apiSecretEnc);

    // баланс (пока только BINANCE)
    if (key.exchange === "BINANCE") {
      const b = await fetchBinanceBalances(apiKey, apiSecret);

      if (!b.ok) {
        return json(
          {
            ok: false,
            error: "EXCHANGE_ERROR",
            exchange: "BINANCE",
            status: b.status,
            message: b.error,
            raw: b.raw,
          },
          { status: 400 }
        );
      }

      return json({
        ok: true,
        exchange: "BINANCE",
        balances: b.balances,
      });
    }

    return json(
      { ok: false, error: "NOT_IMPLEMENTED", message: `Balance for ${key.exchange} not implemented yet` },
      { status: 501 }
    );
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
