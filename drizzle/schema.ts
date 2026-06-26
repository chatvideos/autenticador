import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: int("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  lastSignedIn: int("lastSignedIn", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const totpAccounts = sqliteTable("totp_accounts", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  issuer: text("issuer"),
  secret: text("secret").notNull(),
  icon: text("icon"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: int("createdAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
});

export type TotpAccount = typeof totpAccounts.$inferSelect;
export type InsertTotpAccount = typeof totpAccounts.$inferInsert;
