import crypto from "crypto";

/**
 * Требуется ENV: ENCRYPTION_KEY
 * Вариант: 64 hex символа (32 байта) или обычная строка >= 32 символов.
 *
 * Пример (hex, безопаснее):
 *  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY missing");

  // hex 64 chars -> 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");

  // иначе хэшируем строку до 32 байт
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/**
 * AES-256-GCM:
 * output: base64(iv).base64(tag).base64(ciphertext)
 */
export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM standard
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plain, "utf8")),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptString(box: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = box.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Bad encrypted payload");

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}
