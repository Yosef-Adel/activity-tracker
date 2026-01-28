import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Sessions table - groups consecutive activities by app
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appName: text("app_name").notNull(),
  category: text("category"),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time").notNull(),
  totalDuration: integer("total_duration").notNull().default(0),
  activityCount: integer("activity_count").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Activities table - stores all tracked window activities
export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => sessions.id),
  appName: text("app_name").notNull(),
  windowTitle: text("window_title"),
  url: text("url"),
  category: text("category"),
  projectName: text("project_name"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  language: text("language"),
  domain: text("domain"),
  startTime: integer("start_time").notNull(),
  endTime: integer("end_time").notNull(),
  duration: integer("duration").notNull(),
  contextJson: text("context_json"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// TypeScript types inferred from schema
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
