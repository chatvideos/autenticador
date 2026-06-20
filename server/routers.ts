import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { totp } = _require("@otplib/preset-default") as { totp: { generate: (secret: string) => string } };
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  deleteTotpAccount,
  getTotpAccountById,
  insertTotpAccount,
  listTotpAccounts,
} from "./db";

// ── Password hash (bcrypt of "99550196Jj@") ─────────────────────────────────
// We store the hash in an env var APP_PASSWORD_HASH. If not set, we fall back
// to comparing against APP_PASSWORD (plain-text, for convenience in dev).
function checkPassword(input: string): boolean {
  const hash = process.env.APP_PASSWORD_HASH;
  const plain = process.env.APP_PASSWORD;

  if (hash) {
    return bcrypt.compareSync(input, hash);
  }
  if (plain) {
    return input === plain;
  }
  // Default fallback — should be overridden via env
  return input === "99550196Jj@";
}

// ── TOTP helpers ─────────────────────────────────────────────────────────────

function generateTotpCode(secret: string): { code: string; remaining: number } {
  const code = totp.generate(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const remaining = 30 - (epoch % 30);
  return { code, remaining };
}

// ── Session cookie name for password auth ────────────────────────────────────
const APP_SESSION_COOKIE = "app_session";

function setAppSession(res: any, req: any) {
  const opts = getSessionCookieOptions(req);
  // 8-hour session
  res.cookie(APP_SESSION_COOKIE, "authenticated", {
    ...opts,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearAppSession(res: any, req: any) {
  const opts = getSessionCookieOptions(req);
  res.clearCookie(APP_SESSION_COOKIE, { ...opts, maxAge: -1 });
}

function isAppAuthenticated(req: any): boolean {
  const cookies = req.cookies ?? {};
  return cookies[APP_SESSION_COOKIE] === "authenticated";
}

// ── Router ───────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // Manus OAuth (kept for compatibility)
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Password-based app authentication
  appAuth: router({
    login: publicProcedure
      .input(z.object({ password: z.string().min(1) }))
      .mutation(({ ctx, input }) => {
        if (!checkPassword(input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha incorreta." });
        }
        setAppSession(ctx.res, ctx.req);
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearAppSession(ctx.res, ctx.req);
      return { success: true } as const;
    }),

    check: publicProcedure.query(({ ctx }) => {
      return { authenticated: isAppAuthenticated(ctx.req) };
    }),
  }),

  // TOTP accounts management
  totp: router({
    list: publicProcedure.query(async ({ ctx }) => {
      if (!isAppAuthenticated(ctx.req)) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const accounts = await listTotpAccounts();
      // Generate current codes for each account
      return accounts.map(acc => {
        try {
          const { code, remaining } = generateTotpCode(acc.secret);
          return { ...acc, code, remaining };
        } catch {
          return { ...acc, code: "------", remaining: 30 };
        }
      });
    }),

    add: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(128),
          secret: z.string().min(1).max(256),
          issuer: z.string().max(128).optional(),
          icon: z.string().max(64).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAppAuthenticated(ctx.req)) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        // Validate the secret by trying to generate a code
        try {
          const cleanSecret = input.secret.replace(/\s+/g, "").toUpperCase();
          // Validate Base32 format
          if (!/^[A-Z2-7]+=*$/.test(cleanSecret) || cleanSecret.length < 8) {
            throw new Error("Invalid Base32 secret");
          }
          totp.generate(cleanSecret);
          await insertTotpAccount({
            name: input.name,
            secret: cleanSecret,
            issuer: input.issuer ?? null,
            icon: input.icon ?? null,
          });
          return { success: true } as const;
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Chave secreta inválida. Verifique e tente novamente.",
          });
        }
      }),

    remove: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAppAuthenticated(ctx.req)) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const account = await getTotpAccountById(input.id);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada." });
        }
        await deleteTotpAccount(input.id);
        return { success: true } as const;
      }),

    generateCode: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!isAppAuthenticated(ctx.req)) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const account = await getTotpAccountById(input.id);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return generateTotpCode(account.secret);
      }),
  }),
});

export type AppRouter = typeof appRouter;
