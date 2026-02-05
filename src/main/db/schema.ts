import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Categories table - user-configurable activity categories
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  isDefault: integer("is_default").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  isPassive: integer("is_passive").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Category rules table - matching rules (app, domain, keyword) linked to a category
export const categoryRules = sqliteTable("category_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "app" | "domain" | "keyword" | "domain_keyword"
  pattern: text("pattern").notNull(),
  matchMode: text("match_mode").notNull().default("contains"), // "exact" | "contains" | "regex"
});

// Projects table - user-created projects for grouping sessions
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Pomodoro sessions table - tracks pomodoro timer intervals
export const pomodoroSessions = sqliteTable("pomodoro_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // "work" | "short_break" | "long_break"
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time"),
  duration: integer("duration").notNull(), // target duration in ms
  completed: integer("completed").notNull().default(0),
  label: text("label"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Sessions table - groups consecutive activities by app
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appName: text("app_name").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  projectId: integer("project_id").references(() => projects.id),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time").notNull(),
  totalDuration: integer("total_duration").notNull().default(0),
  activityCount: integer("activity_count").notNull().default(0),
  isManual: integer("is_manual").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Activities table - stores all tracked window activities
export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => sessions.id),
  appName: text("app_name").notNull(),
  windowTitle: text("window_title"),
  url: text("url"),
  categoryId: integer("category_id").references(() => categories.id),
  projectName: text("project_name"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  language: text("language"),
  domain: text("domain"),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time").notNull(),
  duration: integer("duration").notNull(),
  contextJson: text("context_json"),
  pomodoroId: integer("pomodoro_id").references(() => pomodoroSessions.id),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// TypeScript types inferred from schema
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
export type CategoryRuleRow = typeof categoryRules.$inferSelect;
export type NewCategoryRuleRow = typeof categoryRules.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type PomodoroSessionRow = typeof pomodoroSessions.$inferSelect;
export type NewPomodoroSessionRow = typeof pomodoroSessions.$inferInsert;
