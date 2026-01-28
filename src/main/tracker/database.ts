import { gte, lte, and, sql, desc, isNotNull, eq } from "drizzle-orm";
import { getDb, activities, sessions, type NewActivity, type Activity, type Session } from "../db";
import type { Category } from "./categorizer";

// Re-export types for external use
export type { Activity, NewActivity, Session };

export interface ActivityRecord {
  id: number;
  session_id: number | null;
  app_name: string;
  window_title: string | null;
  url: string | null;
  category: string | null;
  project_name: string | null;
  file_name: string | null;
  file_type: string | null;
  language: string | null;
  domain: string | null;
  start_time: number;
  end_time: number;
  duration: number;
  context_json: string | null;
  created_at: string | null;
}

export interface SessionRecord {
  id: number;
  app_name: string;
  category: string | null;
  start_time: number;
  end_time: number;
  total_duration: number;
  activity_count: number;
  created_at: string | null;
}

export interface SessionWithActivities extends SessionRecord {
  activities: ActivityRecord[];
}

class ActivityDatabase {
  private db = getDb();
  private currentSessionId: number | null = null;
  private currentSessionAppName: string | null = null;

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    // Create sessions table
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        category TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        total_duration INTEGER NOT NULL DEFAULT 0,
        activity_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create activities table with session_id reference
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id),
        app_name TEXT NOT NULL,
        window_title TEXT,
        url TEXT,
        category TEXT,
        project_name TEXT,
        file_name TEXT,
        file_type TEXT,
        language TEXT,
        domain TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        context_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add session_id column to existing activities table if it doesn't exist
    try {
      this.db.run(sql`ALTER TABLE activities ADD COLUMN session_id INTEGER REFERENCES sessions(id)`);
    } catch {
      // Column already exists, ignore error
    }

    // Create indexes for faster queries
    this.db.run(sql`CREATE INDEX IF NOT EXISTS idx_app_name ON activities(app_name)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS idx_category ON activities(category)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS idx_project ON activities(project_name)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS idx_start_time ON activities(start_time)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS idx_session_id ON activities(session_id)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time)`);
  }

  // Create a new session
  private createSession(appName: string, category: Category, startTime: number): number {
    const result = this.db
      .insert(sessions)
      .values({
        appName,
        category,
        startTime,
        endTime: startTime,
        totalDuration: 0,
        activityCount: 0,
      })
      .returning({ id: sessions.id })
      .get();

    return result?.id ?? 0;
  }

  // Update session with new activity data
  private updateSession(sessionId: number, endTime: number, duration: number): void {
    this.db
      .update(sessions)
      .set({
        endTime,
        totalDuration: sql`${sessions.totalDuration} + ${duration}`,
        activityCount: sql`${sessions.activityCount} + 1`,
      })
      .where(eq(sessions.id, sessionId))
      .run();
  }

  // Get or create session for an app
  getOrCreateSession(appName: string, category: Category, startTime: number): number {
    // If we have an active session for the same app, use it
    if (this.currentSessionId && this.currentSessionAppName === appName) {
      return this.currentSessionId;
    }

    // Create a new session
    const sessionId = this.createSession(appName, category, startTime);
    this.currentSessionId = sessionId;
    this.currentSessionAppName = appName;
    return sessionId;
  }

  // Close current session (called when app changes or user goes idle)
  closeCurrentSession(): void {
    this.currentSessionId = null;
    this.currentSessionAppName = null;
  }

  // Insert a new activity (with session tracking)
  insertActivity(activity: {
    app_name: string;
    window_title: string;
    url: string | null;
    category: Category;
    project_name: string | null;
    file_name: string | null;
    file_type: string | null;
    language: string | null;
    domain: string | null;
    start_time: number;
    end_time: number;
    duration: number;
    context_json: string | null;
  }): number {
    // Get or create session for this app
    const sessionId = this.getOrCreateSession(
      activity.app_name,
      activity.category,
      activity.start_time
    );

    const result = this.db
      .insert(activities)
      .values({
        sessionId,
        appName: activity.app_name,
        windowTitle: activity.window_title,
        url: activity.url,
        category: activity.category,
        projectName: activity.project_name,
        fileName: activity.file_name,
        fileType: activity.file_type,
        language: activity.language,
        domain: activity.domain,
        startTime: activity.start_time,
        endTime: activity.end_time,
        duration: activity.duration,
        contextJson: activity.context_json,
      })
      .returning({ id: activities.id })
      .get();

    // Update session totals
    this.updateSession(sessionId, activity.end_time, activity.duration);

    return result?.id ?? 0;
  }

  // Get all activities in a time range
  getActivitiesInRange(startTime: number, endTime: number): ActivityRecord[] {
    const results = this.db
      .select()
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .orderBy(desc(activities.startTime))
      .all();

    return results.map(this.mapToRecord);
  }

  // Get app usage aggregated by app name
  getAppUsage(
    startTime: number,
    endTime: number
  ): Array<{ app_name: string; total_duration: number; session_count: number }> {
    const results = this.db
      .select({
        app_name: activities.appName,
        total_duration: sql<number>`sum(${activities.duration})`,
        session_count: sql<number>`count(*)`,
      })
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .groupBy(activities.appName)
      .orderBy(desc(sql`sum(${activities.duration})`))
      .all();

    return results;
  }

  // Get category breakdown
  getCategoryBreakdown(
    startTime: number,
    endTime: number
  ): Array<{ category: Category; total_duration: number; session_count: number }> {
    const results = this.db
      .select({
        category: activities.category,
        total_duration: sql<number>`sum(${activities.duration})`,
        session_count: sql<number>`count(*)`,
      })
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .groupBy(activities.category)
      .orderBy(desc(sql`sum(${activities.duration})`))
      .all();

    return results as Array<{
      category: Category;
      total_duration: number;
      session_count: number;
    }>;
  }

  // Get project time aggregated
  getProjectTime(
    startTime: number,
    endTime: number
  ): Array<{ project_name: string; total_duration: number; session_count: number }> {
    const results = this.db
      .select({
        project_name: activities.projectName,
        total_duration: sql<number>`sum(${activities.duration})`,
        session_count: sql<number>`count(*)`,
      })
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime),
          isNotNull(activities.projectName)
        )
      )
      .groupBy(activities.projectName)
      .orderBy(desc(sql`sum(${activities.duration})`))
      .all();

    return results as Array<{
      project_name: string;
      total_duration: number;
      session_count: number;
    }>;
  }

  // Get domain usage
  getDomainUsage(
    startTime: number,
    endTime: number
  ): Array<{ domain: string; total_duration: number; session_count: number }> {
    const results = this.db
      .select({
        domain: activities.domain,
        total_duration: sql<number>`sum(${activities.duration})`,
        session_count: sql<number>`count(*)`,
      })
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime),
          isNotNull(activities.domain)
        )
      )
      .groupBy(activities.domain)
      .orderBy(desc(sql`sum(${activities.duration})`))
      .all();

    return results as Array<{
      domain: string;
      total_duration: number;
      session_count: number;
    }>;
  }

  // Get hourly pattern for productivity analysis
  getHourlyPattern(
    startTime: number,
    endTime: number
  ): Array<{ hour: string; category: Category; total_duration: number }> {
    const hourExpr = sql<string>`strftime('%H', datetime(${activities.startTime}/1000, 'unixepoch', 'localtime'))`;

    const results = this.db
      .select({
        hour: hourExpr,
        category: activities.category,
        total_duration: sql<number>`sum(${activities.duration})`,
      })
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .groupBy(hourExpr, activities.category)
      .orderBy(hourExpr)
      .all();

    return results as Array<{
      hour: string;
      category: Category;
      total_duration: number;
    }>;
  }

  // Get daily totals for the last N days
  getDailyTotals(
    days: number
  ): Array<{ date: string; total_duration: number; session_count: number }> {
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const dateExpr = sql<string>`date(datetime(${activities.startTime}/1000, 'unixepoch', 'localtime'))`;

    const results = this.db
      .select({
        date: dateExpr,
        total_duration: sql<number>`sum(${activities.duration})`,
        session_count: sql<number>`count(*)`,
      })
      .from(activities)
      .where(gte(activities.startTime, startTime))
      .groupBy(dateExpr)
      .orderBy(desc(dateExpr))
      .all();

    return results;
  }

  // Get total tracked time in range
  getTotalTrackedTime(startTime: number, endTime: number): number {
    const result = this.db
      .select({
        total: sql<number>`sum(${activities.duration})`,
      })
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .get();

    return result?.total ?? 0;
  }

  // Get sessions with their activities in a time range
  getSessionsWithActivities(startTime: number, endTime: number): SessionWithActivities[] {
    // Get all sessions in range
    const sessionRows = this.db
      .select()
      .from(sessions)
      .where(
        and(
          gte(sessions.startTime, startTime),
          lte(sessions.startTime, endTime)
        )
      )
      .orderBy(desc(sessions.startTime))
      .all();

    // Get all activities for these sessions
    const sessionIds = sessionRows.map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const activityRows = this.db
      .select()
      .from(activities)
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .orderBy(desc(activities.startTime))
      .all();

    // Group activities by session
    const activitiesBySession = new Map<number, ActivityRecord[]>();
    for (const activity of activityRows) {
      const sessionId = activity.sessionId ?? 0;
      const sessionActivities = activitiesBySession.get(sessionId) ?? [];
      sessionActivities.push(this.mapToRecord(activity));
      activitiesBySession.set(sessionId, sessionActivities);
    }

    // Combine sessions with their activities
    return sessionRows.map((session) => ({
      id: session.id,
      app_name: session.appName,
      category: session.category,
      start_time: session.startTime,
      end_time: session.endTime,
      total_duration: session.totalDuration,
      activity_count: session.activityCount,
      created_at: session.createdAt,
      activities: activitiesBySession.get(session.id) || [],
    }));
  }

  // Map database row to ActivityRecord (for compatibility)
  private mapToRecord(row: Activity): ActivityRecord {
    return {
      id: row.id,
      session_id: row.sessionId,
      app_name: row.appName,
      window_title: row.windowTitle,
      url: row.url,
      category: row.category,
      project_name: row.projectName,
      file_name: row.fileName,
      file_type: row.fileType,
      language: row.language,
      domain: row.domain,
      start_time: row.startTime,
      end_time: row.endTime,
      duration: row.duration,
      context_json: row.contextJson,
      created_at: row.createdAt,
    };
  }

  // Close is not needed with Drizzle, but keep for API compatibility
  close(): void {
    // Drizzle handles connection management
  }
}

export default ActivityDatabase;
