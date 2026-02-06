import { powerMonitor } from "electron";
import PlatformTracker from "./platformTracker";
import ActivityCategorizer from "./categorizer";
import type { CategorizationResult } from "./categorizer";
import ContextExtractor from "./contextExtractor";
import ActivityDatabase from "./database";
import type { ExtractedContext } from "./contextExtractor";

export interface CurrentActivity {
  appName: string;
  title: string;
  url: string | null;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  context: ExtractedContext;
  confidence?: number;
  matchedRules?: string[];
}

export interface TrackerStatus {
  isRunning: boolean;
  isPaused: boolean;
  isSupported: boolean;
  platformMessage: string;
  currentActivity: CurrentActivity | null;
  trackingSince: number | null;
  isIdle: boolean;
}

class TimeTracker {
  private platformTracker: PlatformTracker;
  private categorizer: ActivityCategorizer;
  private contextExtractor: ContextExtractor;
  private db: ActivityDatabase;

  private currentActivity: CurrentActivity | null = null;
  private activityStartTime: number | null = null;
  private trackingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPaused = false;
  private isIdle = false;
  private checkIntervalMs = 5000; // Check every 5 seconds
  private idleThresholdSeconds = 120; // 2 minutes of inactivity = idle

  private recentCategoryIds: number[] = [];
  private excludedAppsSet: Set<string> = new Set();
  private onActivityChange?: (activity: CurrentActivity | null) => void;

  constructor() {
    this.platformTracker = new PlatformTracker();
    this.categorizer = new ActivityCategorizer();
    this.contextExtractor = new ContextExtractor();
    this.db = new ActivityDatabase();
  }

  setOnActivityChange(
    callback: (activity: CurrentActivity | null) => void,
  ): void {
    this.onActivityChange = callback;
  }

  async start(): Promise<boolean> {
    const platformInfo = this.platformTracker.getPlatformInfo();

    if (!platformInfo.isSupported) {
      return false;
    }

    this.isRunning = true;
    this.loadExcludedApps();
    this.loadIdleTimeout();
    this.loadTrackingInterval();

    this.trackingInterval = setInterval(async () => {
      await this.track();
    }, this.checkIntervalMs);

    // Initial track
    await this.track();

    return true;
  }

  stop(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Save current activity before stopping
    this.saveCurrentActivity();
    this.isRunning = false;
    console.log("Time tracker stopped.");
  }

  private async track(): Promise<void> {
    if (this.isPaused) return;

    const window = await this.platformTracker.getActiveWindow();
    if (!window) return;

    const appName = window.owner.name;

    // System/lock screen apps that mean the user is away — treat as idle
    const IDLE_APPS = ["loginwindow", "ScreenSaverEngine"];
    if (IDLE_APPS.includes(appName)) {
      if (!this.isIdle) {
        console.log(`Lock screen detected (${appName}), treating as idle...`);
        this.isIdle = true;
        this.saveCurrentActivity();
        this.db.closeCurrentSession();
        this.currentActivity = null;
        this.activityStartTime = null;
        if (this.onActivityChange) {
          this.onActivityChange(null);
        }
      }
      return;
    }

    const title = window.title;

    // Skip tracking the app itself and system UI processes
    const EXCLUDED_APPS = [
      "Electron", "Activity Tracker", "activity-tracker",
      "Dock", "SystemUIServer", "Control Center",
      "Notification Center", "UserNotificationCenter",
    ];
    const isBuiltInExcluded = EXCLUDED_APPS.includes(appName);
    const isWindowsTaskbar = appName === "Windows Explorer" && (!title || title === "Taskbar");
    const isUserExcluded = this.excludedAppsSet.has(appName);

    if (isBuiltInExcluded || isWindowsTaskbar || isUserExcluded) {
      if (this.currentActivity) {
        this.saveCurrentActivity();
        this.currentActivity = null;
        this.activityStartTime = null;
        if (this.onActivityChange) {
          this.onActivityChange(null);
        }
      }
      return;
    }

    const url = ("url" in window ? window.url : null) || null;

    const context = this.contextExtractor.extract(appName, title, url);

    // Build file path from extracted context for scoring
    const filePath = context.vscode?.filename || context.filename || null;

    // Categorize first — we need the category to decide if this is passive content
    const result: CategorizationResult = this.categorizer.categorize({
      appName,
      title,
      url,
      filePath,
      recentCategoryIds: this.recentCategoryIds,
    });
    const categoryId = result.categoryId;
    const categoryName = this.categorizer.getCategoryName(categoryId);
    const categoryColor = this.categorizer.getCategoryColor(categoryId);

    // Suppress idle detection for passive content categories (video, meetings, music, learning)
    const passiveContent = this.categorizer.isCategoryPassive(categoryId);

    // Check idle state
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const wasIdle = this.isIdle;
    this.isIdle = idleSeconds >= this.idleThresholdSeconds && !passiveContent;

    // User went idle - save current activity and close session
    if (this.isIdle && !wasIdle) {
      console.log(`User idle for ${idleSeconds}s, pausing tracking...`);
      this.saveCurrentActivity();
      this.db.closeCurrentSession();
      this.currentActivity = null;
      this.activityStartTime = null;

      if (this.onActivityChange) {
        this.onActivityChange(null);
      }
      return;
    }

    // User is still idle - don't track
    if (this.isIdle) {
      return;
    }

    // User returned from idle
    if (!this.isIdle && wasIdle) {
      console.log(
        passiveContent
          ? `Passive content (${appName}), staying active...`
          : "User active again, resuming tracking...",
      );
    }

    // Track recent categories for flow state detection
    this.recentCategoryIds.push(categoryId);
    if (this.recentCategoryIds.length > 5) {
      this.recentCategoryIds = this.recentCategoryIds.slice(-5);
    }

    const activity: CurrentActivity = {
      appName,
      title,
      url,
      categoryId,
      categoryName,
      categoryColor,
      context,
      confidence: result.confidence,
      matchedRules: result.matchedRules,
    };

    if (this.hasActivityChanged(activity)) {
      // Check if the app changed (not just title/url within same app)
      const appChanged = this.hasAppChanged(activity);

      this.saveCurrentActivity();

      // Close session when switching to a different app
      if (appChanged) {
        this.db.closeCurrentSession();
      }

      this.startNewActivity(activity);

      if (this.onActivityChange) {
        this.onActivityChange(activity);
      }
    }
  }

  private hasActivityChanged(newActivity: CurrentActivity): boolean {
    if (!this.currentActivity) return true;

    return (
      this.currentActivity.appName !== newActivity.appName ||
      this.currentActivity.title !== newActivity.title ||
      this.currentActivity.url !== newActivity.url
    );
  }

  private hasAppChanged(newActivity: CurrentActivity): boolean {
    if (!this.currentActivity) return true;
    return this.currentActivity.appName !== newActivity.appName;
  }

  private startNewActivity(activity: CurrentActivity): void {
    this.currentActivity = activity;
    this.activityStartTime = Date.now();
  }

  private saveCurrentActivity(): void {
    if (!this.currentActivity || !this.activityStartTime) return;

    const endTime = Date.now();
    const duration = endTime - this.activityStartTime;

    // Only save if duration is at least 1 second
    if (duration < 1000) return;

    // Short activities (< 30s) get absorbed into the previous activity
    // instead of creating a new entry (reduces noise from quick app switches)
    if (duration < 30_000) {
      const extended = this.db.extendLastActivity(endTime, duration);
      if (extended) return;
      // If no previous activity to extend, fall through and save normally
    }

    // Handle midnight boundary: split activity if it spans days
    const startDate = new Date(this.activityStartTime);
    const endDate = new Date(endTime);
    const startDay = startDate.toDateString();
    const endDay = endDate.toDateString();

    if (startDay !== endDay) {
      // Activity spans midnight - split it
      this.saveActivitySpan(this.activityStartTime, endTime);
    } else {
      // Normal case: same day
      this.insertActivityRecord(this.activityStartTime, endTime, duration);
    }
  }

  // Save an activity that may span multiple days by splitting at midnight boundaries
  private saveActivitySpan(startTime: number, endTime: number): void {
    let currentStart = startTime;

    while (currentStart < endTime) {
      // Get midnight of the next day
      const startDate = new Date(currentStart);
      const nextMidnight = new Date(startDate);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);

      // Determine end of this segment
      const segmentEnd = Math.min(nextMidnight.getTime(), endTime);
      const segmentDuration = segmentEnd - currentStart;

      if (segmentDuration >= 1000) {
        this.insertActivityRecord(currentStart, segmentEnd, segmentDuration);
      }

      currentStart = segmentEnd;
    }
  }

  private insertActivityRecord(startTime: number, endTime: number, duration: number): void {
    if (!this.currentActivity) return;

    const ctx = this.currentActivity.context;

    this.db.insertActivity({
      app_name: this.currentActivity.appName,
      window_title: this.currentActivity.title,
      url: this.currentActivity.url,
      category_id: this.currentActivity.categoryId,
      project_name: ctx.project || null,
      file_name: ctx.filename || null,
      file_type: ctx.fileType || null,
      language: ctx.language || null,
      domain: ctx.domain || null,
      start_time: startTime,
      end_time: endTime,
      duration,
      context_json: JSON.stringify({
        ...ctx,
        categorization: {
          confidence: this.currentActivity.confidence,
          matchedRules: this.currentActivity.matchedRules,
        },
      }),
    });
  }

  pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.saveCurrentActivity();
      this.db.closeCurrentSession();
      this.currentActivity = null;
      this.activityStartTime = null;

      if (this.onActivityChange) {
        this.onActivityChange(null);
      }
      console.log("Tracking paused.");
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      console.log("Tracking resumed.");
    }
  }

  /** Flush the current in-progress activity to the database without stopping tracking. */
  flush(): void {
    if (!this.currentActivity || !this.activityStartTime) return;
    this.saveCurrentActivity();
    // Restart the timer for the same activity so tracking continues seamlessly
    this.activityStartTime = Date.now();
  }

  reloadCategories(): void {
    this.categorizer.reloadRules();
  }

  reloadExcludedApps(): void {
    this.loadExcludedApps();
  }

  private loadExcludedApps(): void {
    const rows = this.db.getExcludedApps();
    this.excludedAppsSet = new Set(rows.map((r) => r.app_name));
  }

  setIdleTimeout(seconds: number): void {
    this.idleThresholdSeconds = seconds;
    this.db.setSetting("idle_timeout_seconds", String(seconds));
  }

  getIdleTimeout(): number {
    return this.idleThresholdSeconds;
  }

  private loadIdleTimeout(): void {
    const value = this.db.getSetting("idle_timeout_seconds");
    if (value !== null) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.idleThresholdSeconds = parsed;
      }
    }
  }

  setTrackingInterval(ms: number): void {
    this.checkIntervalMs = ms;
    this.db.setSetting("tracking_interval_ms", String(ms));

    // Restart the interval if tracking is running
    if (this.isRunning && this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = setInterval(async () => {
        await this.track();
      }, this.checkIntervalMs);
    }
  }

  getTrackingInterval(): number {
    return this.checkIntervalMs;
  }

  private loadTrackingInterval(): void {
    const value = this.db.getSetting("tracking_interval_ms");
    if (value !== null) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 1000) {
        this.checkIntervalMs = parsed;
      }
    }
  }

  getStatus(): TrackerStatus {
    const platformInfo = this.platformTracker.getPlatformInfo();

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isSupported: platformInfo.isSupported,
      platformMessage: platformInfo.message,
      currentActivity: this.currentActivity,
      trackingSince: this.activityStartTime,
      isIdle: this.isIdle,
    };
  }

  getDatabase(): ActivityDatabase {
    return this.db;
  }

  getCategorizer(): ActivityCategorizer {
    return this.categorizer;
  }

  shutdown(): void {
    console.log("\nShutting down tracker...");
    this.stop();
    this.db.close();
  }
}

export default TimeTracker;
