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

    // Check idle state
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const wasIdle = this.isIdle;
    this.isIdle = idleSeconds >= this.idleThresholdSeconds;

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
      console.log("User active again, resuming tracking...");
    }

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

    // Skip tracking the app itself and system UI processes
    const EXCLUDED_APPS = [
      "Electron", "Activity Tracker", "activity-tracker",
      "Dock", "SystemUIServer", "Control Center",
      "Notification Center", "UserNotificationCenter",
    ];
    if (EXCLUDED_APPS.includes(appName)) {
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

    const title = window.title;
    const url = ("url" in window ? window.url : null) || null;

    const context = this.contextExtractor.extract(appName, title, url);

    // Build file path from extracted context for scoring
    const filePath = context.vscode?.filename || context.filename || null;

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
      start_time: this.activityStartTime,
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

  reloadCategories(): void {
    this.categorizer.reloadRules();
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
