import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { InsertUser, InsertTotpAccount, users, totpAccounts } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) {
      console.warn("[Database] TURSO_DATABASE_URL not set");
      return null;
    }
    try {
      const client = createClient({ url, authToken });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      return null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    const now = new Date();
    if (existing.length === 0) {
      await db.insert(users).values({
        ...user,
        role: user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user"),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      });
    } else {
      await db.update(users).set({
        name: user.name ?? existing[0].name,
        email: user.email ?? existing[0].email,
        loginMethod: user.loginMethod ?? existing[0].loginMethod,
        lastSignedIn: now,
        updatedAt: now,
      }).where(eq(users.openId, user.openId));
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── TOTP Accounts ──────────────────────────────────────────────────────────

export async function listTotpAccounts() {
  const db = getDb();
  if (!db) return [];
  return db.select().from(totpAccounts).orderBy(totpAccounts.sortOrder, totpAccounts.createdAt);
}

export async function getTotpAccountById(id: number) {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(totpAccounts).where(eq(totpAccounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function insertTotpAccount(data: InsertTotpAccount) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(totpAccounts).values({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result;
}

export async function deleteTotpAccount(id: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(totpAccounts).where(eq(totpAccounts.id, id));
}
