import { gte, lte, and, sql, desc, isNotNull, eq, like, inArray } from "drizzle-orm";
import { getDb, activities, sessions, categories, type Activity, type Session } from "../db";

// Re-export types for external use
export type { Activity, Session };

export interface ActivityRecord {
  id: number;
  session_id: number | null;
  app_name: string;
  window_title: string | null;
  url: string | null;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
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
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  start_time: number;
  end_time: number;
  total_duration: number;
  activity_count: number;
  created_at: string | null;
}

export interface SessionWithActivities extends SessionRecord {
  activities: ActivityRecord[];
}

const SESSION_MERGE_GAP_MS = 120_000; // 2 minutes

class ActivityDatabase {
  private db = getDb();
  private currentSessionId: number | null = null;
  private currentSessionAppName: string | null = null;

  // Tables and indexes are created in src/main/db/index.ts during getDb() initialization

  // Create a new session
  private createSession(appName: string, categoryId: number, startTime: number): number {
    const result = this.db
      .insert(sessions)
      .values({
        appName,
        categoryId,
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
  getOrCreateSession(appName: string, categoryId: number, startTime: number): number {
    // If we have an active session for the same app, use it
    if (this.currentSessionId && this.currentSessionAppName === appName) {
      return this.currentSessionId;
    }

    // Create a new session
    const sessionId = this.createSession(appName, categoryId, startTime);

    // Try to merge with a recent session of the same category
    const mergedId = this.mergeWithPreviousSession(sessionId, categoryId, startTime);
    if (mergedId !== sessionId) {
      return mergedId;
    }

    this.currentSessionId = sessionId;
    this.currentSessionAppName = appName;
    return sessionId;
  }

  // Close current session (called when app changes or user goes idle)
  closeCurrentSession(): void {
    this.currentSessionId = null;
    this.currentSessionAppName = null;
  }

  // Extend the most recent activity's end_time instead of creating a new one
  // Used for sub-30s activities that should be absorbed into the previous entry
  extendLastActivity(endTime: number, duration: number): boolean {
    // Find the most recent activity
    const lastActivity = this.db
      .select({ id: activities.id, sessionId: activities.sessionId })
      .from(activities)
      .orderBy(desc(activities.endTime))
      .limit(1)
      .get();

    if (!lastActivity) return false;

    // Extend the activity
    this.db
      .update(activities)
      .set({
        endTime,
        duration: sql`${activities.duration} + ${duration}`,
      })
      .where(eq(activities.id, lastActivity.id))
      .run();

    // Extend the parent session
    if (lastActivity.sessionId) {
      this.db
        .update(sessions)
        .set({
          endTime,
          totalDuration: sql`${sessions.totalDuration} + ${duration}`,
        })
        .where(eq(sessions.id, lastActivity.sessionId))
        .run();
    }

    return true;
  }

  // Try to merge a newly created session with a recent session of the same category
  // Returns the merged session ID if merged, or the original sessionId if not
  private mergeWithPreviousSession(sessionId: number, categoryId: number, startTime: number): number {
    // Find the most recent session before this one with the same category
    const prevSession = this.db
      .select({
        id: sessions.id,
        categoryId: sessions.categoryId,
        endTime: sessions.endTime,
        appName: sessions.appName,
      })
      .from(sessions)
      .where(
        and(
          sql`${sessions.id} != ${sessionId}`,
          eq(sessions.categoryId, categoryId),
        )
      )
      .orderBy(desc(sessions.endTime))
      .limit(1)
      .get();

    if (!prevSession) return sessionId;

    // Check if the gap is small enough to merge
    const gap = startTime - prevSession.endTime;
    if (gap > SESSION_MERGE_GAP_MS || gap < 0) return sessionId;

    // Merge: delete the new empty session and reuse the previous one
    this.db.delete(sessions).where(eq(sessions.id, sessionId)).run();

    this.currentSessionId = prevSession.id;
    this.currentSessionAppName = prevSession.appName;

    return prevSession.id;
  }

  // Insert a new activity (with session tracking)
  insertActivity(activity: {
    app_name: string;
    window_title: string;
    url: string | null;
    category_id: number;
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
      activity.category_id,
      activity.start_time
    );

    const result = this.db
      .insert(activities)
      .values({
        sessionId,
        appName: activity.app_name,
        windowTitle: activity.window_title,
        url: activity.url,
        categoryId: activity.category_id,
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

  // Get all activities in a time range (with category info via join)
  getActivitiesInRange(startTime: number, endTime: number): ActivityRecord[] {
    const results = this.db
      .select({
        id: activities.id,
        sessionId: activities.sessionId,
        appName: activities.appName,
        windowTitle: activities.windowTitle,
        url: activities.url,
        categoryId: activities.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        projectName: activities.projectName,
        fileName: activities.fileName,
        fileType: activities.fileType,
        language: activities.language,
        domain: activities.domain,
        startTime: activities.startTime,
        endTime: activities.endTime,
        duration: activities.duration,
        contextJson: activities.contextJson,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .leftJoin(categories, eq(activities.categoryId, categories.id))
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .orderBy(desc(activities.startTime))
      .all();

    return results.map((row) => ({
      id: row.id,
      session_id: row.sessionId,
      app_name: row.appName,
      window_title: row.windowTitle,
      url: row.url,
      category_id: row.categoryId,
      category_name: row.categoryName,
      category_color: row.categoryColor,
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
    }));
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

  // Get category breakdown (with category name and color via join)
  getCategoryBreakdown(
    startTime: number,
    endTime: number
  ): Array<{ category_id: number; category_name: string; category_color: string; total_duration: number; session_count: number }> {
    const results = this.db
      .select({
        category_id: activities.categoryId,
        category_name: categories.name,
        category_color: categories.color,
        total_duration: sql<number>`sum(${activities.duration})`,
        session_count: sql<number>`count(*)`,
      })
      .from(activities)
      .leftJoin(categories, eq(activities.categoryId, categories.id))
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .groupBy(activities.categoryId)
      .orderBy(desc(sql`sum(${activities.duration})`))
      .all();

    return results.map((r) => ({
      category_id: r.category_id ?? 0,
      category_name: r.category_name ?? "uncategorized",
      category_color: r.category_color ?? "#64748B",
      total_duration: r.total_duration,
      session_count: r.session_count,
    }));
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

  // Get hourly pattern for productivity analysis (with category name via join)
  getHourlyPattern(
    startTime: number,
    endTime: number
  ): Array<{ hour: string; category_name: string; category_color: string; total_duration: number }> {
    const hourExpr = sql<string>`strftime('%H', datetime(${activities.startTime}/1000, 'unixepoch', 'localtime'))`;

    const results = this.db
      .select({
        hour: hourExpr,
        category_name: categories.name,
        category_color: categories.color,
        total_duration: sql<number>`sum(${activities.duration})`,
      })
      .from(activities)
      .leftJoin(categories, eq(activities.categoryId, categories.id))
      .where(
        and(
          gte(activities.startTime, startTime),
          lte(activities.startTime, endTime)
        )
      )
      .groupBy(hourExpr, activities.categoryId)
      .orderBy(hourExpr)
      .all();

    return results.map((r) => ({
      hour: r.hour,
      category_name: r.category_name ?? "uncategorized",
      category_color: r.category_color ?? "#64748B",
      total_duration: r.total_duration,
    }));
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
    // Get all sessions in range with category info
    const sessionRows = this.db
      .select({
        id: sessions.id,
        appName: sessions.appName,
        categoryId: sessions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        totalDuration: sessions.totalDuration,
        activityCount: sessions.activityCount,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .leftJoin(categories, eq(sessions.categoryId, categories.id))
      .where(
        and(
          gte(sessions.startTime, startTime),
          lte(sessions.startTime, endTime)
        )
      )
      .orderBy(desc(sessions.startTime))
      .all();

    if (sessionRows.length === 0) return [];

    // Get all activities for these sessions
    const activityRows = this.db
      .select({
        id: activities.id,
        sessionId: activities.sessionId,
        appName: activities.appName,
        windowTitle: activities.windowTitle,
        url: activities.url,
        categoryId: activities.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        projectName: activities.projectName,
        fileName: activities.fileName,
        fileType: activities.fileType,
        language: activities.language,
        domain: activities.domain,
        startTime: activities.startTime,
        endTime: activities.endTime,
        duration: activities.duration,
        contextJson: activities.contextJson,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .leftJoin(categories, eq(activities.categoryId, categories.id))
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
    for (const row of activityRows) {
      const sessionId = row.sessionId ?? 0;
      const sessionActivities = activitiesBySession.get(sessionId) ?? [];
      sessionActivities.push({
        id: row.id,
        session_id: row.sessionId,
        app_name: row.appName,
        window_title: row.windowTitle,
        url: row.url,
        category_id: row.categoryId,
        category_name: row.categoryName,
        category_color: row.categoryColor,
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
      });
      activitiesBySession.set(sessionId, sessionActivities);
    }

    // Combine sessions with their activities
    return sessionRows.map((session) => ({
      id: session.id,
      app_name: session.appName,
      category_id: session.categoryId,
      category_name: session.categoryName ?? "uncategorized",
      category_color: session.categoryColor ?? "#64748B",
      start_time: session.startTime,
      end_time: session.endTime,
      total_duration: session.totalDuration,
      activity_count: session.activityCount,
      created_at: session.createdAt,
      activities: activitiesBySession.get(session.id) || [],
    }));
  }

  // Recategorize all activities in a session and the session itself
  recategorizeSession(sessionId: number, categoryId: number): void {
    this.db
      .update(activities)
      .set({ categoryId })
      .where(eq(activities.sessionId, sessionId))
      .run();
    this.db
      .update(sessions)
      .set({ categoryId })
      .where(eq(sessions.id, sessionId))
      .run();
  }

  // Recategorize all sessions/activities matching a rule pattern
  recategorizeByRule(ruleType: string, pattern: string, categoryId: number): number {
    let matchingSessionIds: number[] = [];

    if (ruleType === "domain") {
      // Find all sessions that have activities with this domain
      const rows = this.db
        .selectDistinct({ sessionId: activities.sessionId })
        .from(activities)
        .where(eq(activities.domain, pattern))
        .all();
      matchingSessionIds = rows.filter((r) => r.sessionId !== null).map((r) => r.sessionId as number);
    } else if (ruleType === "app") {
      const rows = this.db
        .selectDistinct({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.appName, pattern))
        .all();
      matchingSessionIds = rows.map((r) => r.id);
    } else if (ruleType === "domain_keyword") {
      const [domain, ...keywordParts] = pattern.split("|");
      const keyword = keywordParts.join("|");
      const rows = this.db
        .selectDistinct({ sessionId: activities.sessionId })
        .from(activities)
        .where(
          and(
            eq(activities.domain, domain),
            like(activities.windowTitle, `%${keyword}%`),
          ),
        )
        .all();
      matchingSessionIds = rows.filter((r) => r.sessionId !== null).map((r) => r.sessionId as number);
    } else if (ruleType === "keyword") {
      const rows = this.db
        .selectDistinct({ sessionId: activities.sessionId })
        .from(activities)
        .where(like(activities.windowTitle, `%${pattern}%`))
        .all();
      matchingSessionIds = rows.filter((r) => r.sessionId !== null).map((r) => r.sessionId as number);
    }

    if (matchingSessionIds.length === 0) return 0;

    // Update all matching activities
    this.db
      .update(activities)
      .set({ categoryId })
      .where(inArray(activities.sessionId, matchingSessionIds))
      .run();

    // Update all matching sessions
    this.db
      .update(sessions)
      .set({ categoryId })
      .where(inArray(sessions.id, matchingSessionIds))
      .run();

    return matchingSessionIds.length;
  }

  // Close is not needed with Drizzle, but keep for API compatibility
  close(): void {
    // Drizzle handles connection management
  }
}

export default ActivityDatabase;
