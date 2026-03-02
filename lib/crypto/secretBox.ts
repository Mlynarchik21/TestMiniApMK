import crypto from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12; // recommended for GCM
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.SECRET_KEY_HEX;
  if (!hex) throw new Error("SECRET_KEY_HEX is missing");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("SECRET_KEY_HEX must be 32 bytes (64 hex chars)");
  return key;
}

export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);

  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // format: iv:tag:ciphertext (base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptString(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid ciphertext format");

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
