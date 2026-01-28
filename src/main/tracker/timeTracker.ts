import PlatformTracker from "./platformTracker";
import ActivityCategorizer from "./categorizer";
import ContextExtractor from "./contextExtractor";
import ActivityDatabase from "./database";
import type { ExtractedContext } from "./contextExtractor";
import type { Category } from "./categorizer";

export interface CurrentActivity {
  appName: string;
  title: string;
  url: string | null;
  category: Category;
  context: ExtractedContext;
}

export interface TrackerStatus {
  isRunning: boolean;
  isSupported: boolean;
  platformMessage: string;
  currentActivity: CurrentActivity | null;
  trackingSince: number | null;
}

class TimeTracker {
  private platformTracker: PlatformTracker;
  private categorizer: ActivityCategorizer;
  private contextExtractor: ContextExtractor;
  private db: ActivityDatabase;

  private currentActivity: CurrentActivity | null = null;
  private activityStartTime: number | null = null;
  private trackingInterval: NodeJS.Timeout | null = null;
  private saveInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 5000; // Check every 5 seconds
  private saveIntervalMs = 30000; // Save current activity every 30 seconds

  private onActivityChange?: (activity: CurrentActivity | null) => void;

  constructor() {
    this.platformTracker = new PlatformTracker();
    this.categorizer = new ActivityCategorizer();
    this.contextExtractor = new ContextExtractor();
    this.db = new ActivityDatabase();
  }

  setOnActivityChange(callback: (activity: CurrentActivity | null) => void): void {
    this.onActivityChange = callback;
  }

  async start(): Promise<boolean> {
    const platformInfo = this.platformTracker.getPlatformInfo();
    console.log("\n🕐 Time Tracker Starting...");
    console.log(platformInfo.message);

    if (!platformInfo.isSupported) {
      console.log("\n⚠️  Automatic tracking is not available on this system.");
      return false;
    }

    this.isRunning = true;
    console.log("\n✓ Automatic time tracking started.\n");

    this.trackingInterval = setInterval(async () => {
      await this.track();
    }, this.checkIntervalMs);

    // Periodically save current activity (even if window hasn't changed)
    this.saveInterval = setInterval(() => {
      this.saveAndContinueActivity();
    }, this.saveIntervalMs);

    // Initial track
    await this.track();

    return true;
  }

  // Save current activity but continue tracking it (for periodic saves)
  private saveAndContinueActivity(): void {
    if (!this.currentActivity || !this.activityStartTime) return;

    const now = Date.now();
    const duration = now - this.activityStartTime;

    // Only save if duration is at least 1 second
    if (duration < 1000) return;

    const ctx = this.currentActivity.context;

    this.db.insertActivity({
      app_name: this.currentActivity.appName,
      window_title: this.currentActivity.title,
      url: this.currentActivity.url,
      category: this.currentActivity.category,
      project_name: ctx.project || null,
      file_name: ctx.filename || null,
      file_type: ctx.fileType || null,
      language: ctx.language || null,
      domain: ctx.domain || null,
      start_time: this.activityStartTime,
      end_time: now,
      duration,
      context_json: JSON.stringify(ctx),
    });

    // Reset start time to now so we don't double-count
    this.activityStartTime = now;

    // Notify UI of the update
    if (this.onActivityChange) {
      this.onActivityChange(this.currentActivity);
    }
  }

  stop(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    // Save current activity before stopping
    this.saveCurrentActivity();
    this.isRunning = false;
    console.log("Time tracker stopped.");
  }

  private async track(): Promise<void> {
    const window = await this.platformTracker.getActiveWindow();
    if (!window) return;

    const appName = window.owner.name;
    const title = window.title;
    const url = window.url || null;

    const context = this.contextExtractor.extract(appName, title, url);
    const category = this.categorizer.categorize({ appName, title, url });

    const activity: CurrentActivity = {
      appName,
      title,
      url,
      category,
      context,
    };

    if (this.hasActivityChanged(activity)) {
      this.saveCurrentActivity();
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
      category: this.currentActivity.category,
      project_name: ctx.project || null,
      file_name: ctx.filename || null,
      file_type: ctx.fileType || null,
      language: ctx.language || null,
      domain: ctx.domain || null,
      start_time: this.activityStartTime,
      end_time: endTime,
      duration,
      context_json: JSON.stringify(ctx),
    });
  }

  getStatus(): TrackerStatus {
    const platformInfo = this.platformTracker.getPlatformInfo();

    return {
      isRunning: this.isRunning,
      isSupported: platformInfo.isSupported,
      platformMessage: platformInfo.message,
      currentActivity: this.currentActivity,
      trackingSince: this.activityStartTime,
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
