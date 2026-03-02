// lib/crypto/secretBox.ts
import crypto from "crypto";

/**
 * AES-256-GCM secret box
 * - KEY_ENCRYPTION_SECRET: любая строка (мы её хэшируем в 32 байта)
 * - на выходе: base64(JSON({v,iv,tag,data}))
 */

type BoxPayload = {
  v: 1;
  iv: string;   // base64
  tag: string;  // base64
  data: string; // base64
};

function getKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("KEY_ENCRYPTION_SECRET missing");
  // стабильный 32-byte key
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM best practice: 12 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const enc1 = cipher.update(plain, "utf8");
  const enc2 = cipher.final();
  const tag = cipher.getAuthTag();

  const payload: BoxPayload = {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: Buffer.concat([enc1, enc2]).toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decryptSecret(box: string): string {
  const key = getKey();

  const json = Buffer.from(box, "base64").toString("utf8");
  const payload = JSON.parse(json) as BoxPayload;

  if (!payload || payload.v !== 1) throw new Error("Bad secret box version");

  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const dec1 = decipher.update(data);
  const dec2 = decipher.final();

  return Buffer.concat([dec1, dec2]).toString("utf8");
}
