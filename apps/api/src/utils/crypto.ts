import crypto from "node:crypto";
import { env } from "../config/env.js";

const algorithm = "aes-256-gcm";

function key() {
  return crypto.createHash("sha256").update(env.APP_SECRET).digest();
}

export function encryptSecret(value?: string | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(value?: string | null) {
  if (!value) return null;
  const [ivPart, tagPart, cipherPart] = value.split(".");
  if (!ivPart || !tagPart || !cipherPart) return null;
  const decipher = crypto.createDecipheriv(
    algorithm,
    key(),
    Buffer.from(ivPart, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherPart, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}
