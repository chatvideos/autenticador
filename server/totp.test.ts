import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  listTotpAccounts: vi.fn().mockResolvedValue([]),
  getTotpAccountById: vi.fn().mockResolvedValue(null),
  insertTotpAccount: vi.fn().mockResolvedValue({}),
  deleteTotpAccount: vi.fn().mockResolvedValue(undefined),
}));

function createAuthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: { app_session: "authenticated" },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("appAuth.check", () => {
  it("returns authenticated=true when session cookie is set", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.appAuth.check();
    expect(result.authenticated).toBe(true);
  });

  it("returns authenticated=false when no session cookie", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.appAuth.check();
    expect(result.authenticated).toBe(false);
  });
});

describe("appAuth.login", () => {
  it("sets session cookie on correct password", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.appAuth.login({ password: "99550196Jj@" });
    expect(result.success).toBe(true);
    expect((ctx.res.cookie as any).mock.calls.length).toBeGreaterThan(0);
  });

  it("throws UNAUTHORIZED on wrong password", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.appAuth.login({ password: "wrongpassword" })
    ).rejects.toThrow();
  });
});

describe("totp.list", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.totp.list()).rejects.toThrow();
  });

  it("returns empty array when authenticated and no accounts", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.totp.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("totp.add", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.totp.add({ name: "Test", secret: "JBSWY3DPEHPK3PXP" })
    ).rejects.toThrow();
  });

  it("throws BAD_REQUEST on invalid secret", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.totp.add({ name: "Test", secret: "INVALID!!SECRET!!" })
    ).rejects.toThrow();
  });

  it("succeeds with valid secret", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.totp.add({
      name: "Test Account",
      secret: "JBSWY3DPEHPK3PXP",
      issuer: "TestService",
    });
    expect(result.success).toBe(true);
  });
});
