import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { encryptPasswordForAccount } from "./_core/passwordVault";
import { hashPassword } from "./_core/password";

const mocks = vi.hoisted(() => ({ getUserById: vi.fn() }));
vi.mock("./db", () => ({ getUserById: mocks.getUserById }));
import { appRouter } from "./routers";

const keyName = "REBIOMED_PASSWORD_VAULT_KEY";
const originalKey = process.env[keyName];
const account = (id: number, role: "user" | "admin", vault: string | null) => ({ id, role, openId: `account-${id}`, loginMethod: "email", passwordVault: vault });
function caller(username: string | null, role: "user" | "admin", id = 99) {
  const setHeader = vi.fn();
  const ctx = { user: { id, username, role, passwordHash: hashPassword("admin-current") }, res: { setHeader } } as unknown as TrpcContext;
  return { api: appRouter.createCaller(ctx), setHeader };
}

beforeEach(() => {
  process.env[keyName] = Buffer.alloc(32, 19).toString("base64");
  mocks.getUserById.mockReset();
});
afterEach(() => {
  if (originalKey === undefined) delete process.env[keyName];
  else process.env[keyName] = originalKey;
});

describe("team.viewPassword", () => {
  it("allows an Admin to reveal a User password on demand without returning the hash", async () => {
    mocks.getUserById.mockResolvedValue(account(1, "user", encryptPasswordForAccount("user-secret", "account-1")));
    const { api, setHeader } = caller("other-admin", "admin");
    expect(await api.team.viewPassword({ id: 1, currentPassword: "admin-current" })).toEqual({ available: true, password: "user-secret" });
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("does not allow an Admin to reveal another Admin password", async () => {
    mocks.getUserById.mockResolvedValue(account(2, "admin", encryptPasswordForAccount("admin-secret", "account-2")));
    await expect(caller("other-admin", "admin").api.team.viewPassword({ id: 2, currentPassword: "admin-current" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows Wstratos to reveal both Admin and User passwords", async () => {
    const admin = account(2, "admin", encryptPasswordForAccount("admin-secret", "account-2"));
    const user = account(1, "user", encryptPasswordForAccount("user-secret", "account-1"));
    mocks.getUserById.mockImplementation((id: number) => Promise.resolve(id === 2 ? admin : user));
    const { api } = caller("Wstratos", "admin");
    expect((await api.team.viewPassword({ id: 2, currentPassword: "admin-current" })).password).toBe("admin-secret");
    expect((await api.team.viewPassword({ id: 1, currentPassword: "admin-current" })).password).toBe("user-secret");
  });

  it("never gives non-admin sessions access, and reports legacy hashes as unavailable", async () => {
    mocks.getUserById.mockResolvedValue(account(1, "user", null));
    await expect(caller("visitor", "user").api.team.viewPassword({ id: 1, currentPassword: "admin-current" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await caller("other-admin", "admin").api.team.viewPassword({ id: 1, currentPassword: "admin-current" })).toEqual({ available: false, password: null });
  });

  it("lets an Admin view their own password but rejects a wrong current password", async () => {
    mocks.getUserById.mockResolvedValue(account(3, "admin", encryptPasswordForAccount("my-password", "account-3")));
    const { api } = caller("ordinary-admin", "admin", 3);
    await expect(api.team.viewPassword({ id: 3, currentPassword: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect((await api.team.viewPassword({ id: 3, currentPassword: "admin-current" })).password).toBe("my-password");
  });
});
