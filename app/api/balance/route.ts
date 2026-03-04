// app/api/balance/route.ts
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/requireUser";
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

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const keyId = (url.searchParams.get("keyId") || "").trim();
    if (!keyId) return json({ ok: false, error: "BAD_REQUEST", message: "keyId required" }, { status: 400 });

    const key = await prisma.userKey.findFirst({
      where: { id: keyId, userId: user.id },
      select: {
        id: true,
        exchange: true,
        apiKey: true,
        secretEnc: true,
        passphraseEnc: true,
      },
    });

    if (!key) return json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    if (key.exchange !== "BINANCE") {
      return json(
        { ok: false, error: "NOT_IMPLEMENTED", message: `Balance for ${key.exchange} not implemented yet` },
        { status: 400 }
      );
    }

    // ✅ в БД лежит ENCRYPTED, тут расшифровываем
    const apiKey = decryptString(key.apiKey);
    const apiSecret = decryptString(key.secretEnc);

    const base = "https://api.binance.com";
    const timestamp = Date.now();
    const recvWindow = 5000;

    const qs = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = hmacSha256Hex(apiSecret, qs);

    const r = await fetch(`${base}/api/v3/account?${qs}&signature=${signature}`, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
      cache: "no-store",
    });

    const text = await r.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    // Binance при ошибке отдаёт { code, msg }
    if (!r.ok) {
      return json(
        {
          ok: false,
          error: "EXCHANGE_ERROR",
          status: r.status,
          details: data,
        },
        { status: 400 }
      );
    }

    const balances = Array.isArray(data?.balances) ? data.balances : [];
    const nonZero = balances
      .map((b: any) => ({
        asset: String(b.asset),
        free: String(b.free),
        locked: String(b.locked),
      }))
      .filter((b: any) => Number(b.free) !== 0 || Number(b.locked) !== 0);

    return json({
      ok: true,
      exchange: "BINANCE",
      accountType: "SPOT",
      keyId: key.id,
      balances: nonZero,
      // если хочешь видеть всё:
      // raw: data,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return json(
      { ok: false, error: status === 401 ? "UNAUTHORIZED" : "SERVER_ERROR", message: e?.message ?? String(e) },
      { status }
    );
  }
}
