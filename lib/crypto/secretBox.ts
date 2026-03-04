// lib/crypto/secretBox.ts
import crypto from "crypto";

function getKey(): Buffer {
  const hex = process.env.SECRET_BOX_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("SECRET_BOX_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Формат: ivB64:tagB64:cipherB64
 * iv = 12 bytes (GCM), tag = 16 bytes
 */
export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptString(payload: string): string {
  const key = getKey();
  const parts = String(payload || "").split(":");
  if (parts.length !== 3) throw new Error("Bad secretBox payload format");

  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(cipherB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
