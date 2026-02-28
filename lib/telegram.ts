import crypto from "crypto";

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const data: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "hash") data[key] = value;
  });

  return { hash, data };
}

export function verifyTelegramInitData(initData: string, botToken: string) {
  const parsed = parseInitData(initData);
  if (!parsed) return null;

  const { hash, data } = parsed;

  // data_check_string
  const dataCheckString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");

  // secret_key = SHA256(botToken)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  // HMAC-SHA256(data_check_string, secret_key) in hex
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  // опционально: проверка свежести auth_date (например 24 часа)
  const authDate = Number(data["auth_date"] || "0");
  if (authDate) {
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > 60 * 60 * 24) return null; // старше 24ч
  }

  // user приходит JSON строкой
  let user: any = null;
  if (data["user"]) {
    try {
      user = JSON.parse(data["user"]);
    } catch {
      user = null;
    }
  }

  return { data, user };
}
