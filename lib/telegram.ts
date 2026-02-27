import crypto from "crypto";

export function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  const entries: string[] = [];
  Array.from(params.keys())
    .sort()
    .forEach((key) => {
      const val = params.get(key) ?? "";
      entries.push(`${key}=${val}`);
    });

  const dataCheckString = entries.join("\n");
  return { hash, dataCheckString, params };
}

export function validateTelegramInitData(initData: string, botToken: string) {
  const { hash, dataCheckString, params } = parseInitData(initData);
  if (!hash) return { ok: false as const, error: "MISSING_HASH" };

  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return { ok: false as const, error: "BAD_INITDATA" };

  // auth_date (24 часа)
  const authDate = Number(params.get("auth_date") || "0");
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 60 * 60 * 24) {
    return { ok: false as const, error: "INITDATA_EXPIRED" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false as const, error: "NO_USER" };

  let user: any;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false as const, error: "BAD_USER_JSON" };
  }

  if (!user?.id) return { ok: false as const, error: "NO_USER_ID" };

  return { ok: true as const, user };
}
