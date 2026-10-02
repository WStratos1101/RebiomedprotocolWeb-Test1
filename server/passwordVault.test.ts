import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptPasswordForAccount, encryptPasswordForAccount } from "./_core/passwordVault";

const keyName = "REBIOMED_PASSWORD_VAULT_KEY";
const originalKey = process.env[keyName];

beforeEach(() => { process.env[keyName] = Buffer.alloc(32, 17).toString("base64"); });
afterEach(() => {
  if (originalKey === undefined) delete process.env[keyName];
  else process.env[keyName] = originalKey;
});

describe("password vault", () => {
  it("encrypts distinct non-plaintext entries and decrypts for the same account", () => {
    const first = encryptPasswordForAccount("mật khẩu thử nghiệm", "account-1");
    const second = encryptPasswordForAccount("mật khẩu thử nghiệm", "account-1");
    expect(first).not.toContain("mật khẩu thử nghiệm");
    expect(first).not.toBe(second);
    expect(decryptPasswordForAccount(first, "account-1")).toBe("mật khẩu thử nghiệm");
  });

  it("rejects swapped, corrupted, or unavailable ciphertext", () => {
    const sealed = encryptPasswordForAccount("SufficientlyLong!", "account-1");
    expect(() => decryptPasswordForAccount(sealed, "account-2")).toThrow();
    const [version, nonce, encrypted, tag] = sealed.split(".");
    const corrupted = [version, nonce, encrypted, (tag[0] === "a" ? "b" : "a") + tag.slice(1)].join(".");
    expect(() => decryptPasswordForAccount(corrupted, "account-1")).toThrow();
    delete process.env[keyName];
    expect(() => encryptPasswordForAccount("another", "account-1")).toThrow("not configured");
    expect(() => decryptPasswordForAccount(sealed, "account-1")).toThrow("not configured");
    process.env[keyName] = "different-code";
    expect(() => decryptPasswordForAccount(sealed, "account-1")).toThrow();
    process.env[keyName] = "not-a-valid-key";
    expect(() => encryptPasswordForAccount("another", "account-1")).not.toThrow();
  });
});
