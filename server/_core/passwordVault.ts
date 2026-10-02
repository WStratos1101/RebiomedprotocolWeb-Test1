import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_NAME = "REBIOMED_PASSWORD_VAULT_KEY";
const VERSION = "v1";

function encryptionKey(): Buffer {
  const encoded = process.env[KEY_NAME];
  if (!encoded) throw new Error("Password vault key is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new Error("Password vault key must be 32 random bytes encoded in base64");
  }
  return key;
}

/** Bind ciphertext to the account's immutable openId so it cannot be swapped between accounts. */
export function encryptPasswordForAccount(password: string, openId: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(Buffer.from(openId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return [VERSION, nonce.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function decryptPasswordForAccount(sealed: string, openId: string): string {
  const [version, nonceString, encryptedString, tagString, extra] = sealed.split(".");
  if (version !== VERSION || !nonceString || !encryptedString || !tagString || extra) throw new Error("Invalid password vault entry");
  const nonce = Buffer.from(nonceString, "base64url");
  const tag = Buffer.from(tagString, "base64url");
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("Invalid password vault entry");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce);
  decipher.setAAD(Buffer.from(openId, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(encryptedString, "base64url")), decipher.final()]).toString("utf8");
}
