import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "researcher", "viewer", "user"]).default("researcher").notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("approved").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const protocols = mysqlTable("protocols", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  tag: varchar("tag", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["Đã duyệt", "Bản nháp"]).default("Bản nháp").notNull(),
  version: varchar("version", { length: 32 }).default("v0.1").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  owner: varchar("owner", { length: 160 }).notNull(),
  summary: text("summary").notNull(),
  duration: varchar("duration", { length: 80 }).notNull(),
  steps: json("steps").notNull(),
  notes: json("notes").notNull(),
});

export const samples = mysqlTable("samples", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  groupName: varchar("groupName", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).default("Bản nháp").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  description: text("description").notNull(),
  properties: json("properties").notNull(),
  theory: text("theory").notNull(),
});

export const calculators = mysqlTable("calculators", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  formula: varchar("formula", { length: 160 }).notNull(),
  description: text("description").notNull(),
  config: json("config").notNull(),
  active: int("active").default(1).notNull(),
});

export const experimentRuns = mysqlTable("experimentRuns", {
  id: int("id").autoincrement().primaryKey(),
  runCode: varchar("runCode", { length: 60 }).notNull().unique(),
  runDate: varchar("runDate", { length: 20 }).notNull(),
  ctMean: decimal("ctMean", { precision: 8, scale: 3 }).notNull(),
  efficiency: decimal("efficiency", { precision: 8, scale: 3 }).notNull(),
  protocolSlug: varchar("protocolSlug", { length: 120 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Protocol = typeof protocols.$inferSelect;
export type Sample = typeof samples.$inferSelect;
export type Calculator = typeof calculators.$inferSelect;
export type ExperimentRun = typeof experimentRuns.$inferSelect;
