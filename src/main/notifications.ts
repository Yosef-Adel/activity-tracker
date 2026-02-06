import { Notification } from "electron";
import type ActivityDatabase from "./tracker/database";

interface DailyGoal {
  categoryName: string;
  targetMs: number;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export class NotificationManager {
  private db: ActivityDatabase;
  private breakTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBreakNotification = 0;
  private dailySummaryTimer: ReturnType<typeof setTimeout> | null = null;
  private dailySummaryShownToday = false;
  private lastSummaryDate: string | null = null;

  constructor(db: ActivityDatabase) {
    this.db = db;
    this.scheduleDailySummary();
  }

  /** Get the set of goals already notified today (persisted in DB). */
  private getNotifiedGoalsToday(): Set<string> {
    const stored = this.db.getSetting("goals_notified_today");
    if (!stored) return new Set();

    try {
      const parsed = JSON.parse(stored);
      const today = new Date().toDateString();
      // Check if the stored data is from today
      if (parsed.date === today && Array.isArray(parsed.goals)) {
        return new Set(parsed.goals);
      }
    } catch {
      // Ignore parse errors
    }
    return new Set();
  }

  /** Mark a goal as notified today (persisted in DB). */
  private markGoalNotified(categoryName: string): void {
    const notified = this.getNotifiedGoalsToday();
    notified.add(categoryName);
    const today = new Date().toDateString();
    this.db.setSetting("goals_notified_today", JSON.stringify({
      date: today,
      goals: Array.from(notified),
    }));
  }

  /** Called when user becomes active (activity started or changed). */
  onActivityStarted(): void {
    if (!this.isBreakRemindersEnabled()) return;
    this.resetBreakTimer();
  }

  /** Called when user goes idle. Clears break timer since they're resting. */
  onIdle(): void {
    this.clearBreakTimer();
  }

  /** Called when tracking is paused. */
  onPaused(): void {
    this.clearBreakTimer();
  }

  /** Check if any daily goals have been reached and fire notifications. */
  checkGoals(): void {
    if (!this.isEnabled()) return;

    const goalsJson = this.db.getSetting("daily_goals");
    if (!goalsJson) return;

    let goals: DailyGoal[];
    try {
      goals = JSON.parse(goalsJson);
      if (!Array.isArray(goals)) return;
    } catch {
      return;
    }

    // Get today's start timestamp
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTs = startOfToday.getTime();

    const breakdown = this.db.getCategoryBreakdown(startTs, now);
    const notifiedToday = this.getNotifiedGoalsToday();

    for (const goal of goals) {
      if (notifiedToday.has(goal.categoryName)) continue;

      const match = breakdown.find((c) => c.category_name === goal.categoryName);
      const currentMs = match?.total_duration ?? 0;

      if (currentMs >= goal.targetMs) {
        this.markGoalNotified(goal.categoryName);
        const label = goal.categoryName.replace(/_/g, " ");
        const hours = (goal.targetMs / 3600000).toFixed(1).replace(/\.0$/, "");
        new Notification({
          title: "Goal reached!",
          body: `You hit your ${label} goal of ${hours}h.`,
        }).show();
      }
    }
  }

  /** Fire notification when a pomodoro completes. */
  onPomodoroComplete(type: string, durationMs: number, label?: string): void {
    if (!this.isEnabled() || !this.isPomodoroNotificationsEnabled()) return;

    const minutes = Math.round(durationMs / 60000);

    let title: string;
    let body: string;

    if (type === "work") {
      title = "Pomodoro complete!";
      body = label ? `"${label}" finished — ${minutes} min of focused work.` : `${minutes} min of focused work complete.`;
    } else {
      title = "Break's over!";
      body = `Your ${minutes} min ${type.replace(/_/g, " ")} is done. Ready to focus?`;
    }

    new Notification({ title, body }).show();
  }

  /** Clean up timers. */
  shutdown(): void {
    this.clearBreakTimer();
    this.clearDailySummaryTimer();
  }

  // --- Private helpers ---

  private isEnabled(): boolean {
    const val = this.db.getSetting("notifications_enabled");
    return val !== "false"; // defaults to enabled
  }

  private isBreakRemindersEnabled(): boolean {
    if (!this.isEnabled()) return false;
    const val = this.db.getSetting("break_reminders_enabled");
    return val !== "false"; // defaults to enabled
  }

  private getBreakIntervalMs(): number {
    const val = this.db.getSetting("break_interval_minutes");
    const minutes = val ? parseInt(val, 10) : 60;
    return (isNaN(minutes) || minutes < 1 ? 60 : minutes) * 60_000;
  }

  private resetBreakTimer(): void {
    this.clearBreakTimer();
    const intervalMs = this.getBreakIntervalMs();
    this.breakTimer = setTimeout(() => {
      this.fireBreakReminder(intervalMs);
    }, intervalMs);
  }

  private clearBreakTimer(): void {
    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }
  }

  private fireBreakReminder(intervalMs: number): void {
    const now = Date.now();
    // Guard: minimum 5 min between break notifications
    if (now - this.lastBreakNotification < 5 * 60_000) return;

    this.lastBreakNotification = now;
    const minutes = Math.round(intervalMs / 60_000);
    new Notification({
      title: "Time for a break!",
      body: `You've been working for ${minutes} minutes.`,
    }).show();
  }

  private isPomodoroNotificationsEnabled(): boolean {
    const val = this.db.getSetting("pomodoro_notifications_enabled");
    return val !== "false"; // defaults to enabled
  }

  private isDailySummaryEnabled(): boolean {
    if (!this.isEnabled()) return false;
    const val = this.db.getSetting("daily_summary_enabled");
    return val !== "false"; // defaults to enabled
  }

  private getDailySummaryHour(): number {
    const val = this.db.getSetting("daily_summary_hour");
    const hour = val ? parseInt(val, 10) : 18; // Default to 6 PM
    return isNaN(hour) || hour < 0 || hour > 23 ? 18 : hour;
  }

  private scheduleDailySummary(): void {
    this.clearDailySummaryTimer();

    const now = new Date();
    const summaryHour = this.getDailySummaryHour();

    // Calculate next summary time
    const nextSummary = new Date();
    nextSummary.setHours(summaryHour, 0, 0, 0);

    // If we've passed today's summary time, schedule for tomorrow
    if (now >= nextSummary) {
      nextSummary.setDate(nextSummary.getDate() + 1);
      // Reset the flag for the new day
      if (now.toDateString() !== this.lastSummaryDate) {
        this.dailySummaryShownToday = false;
      }
    }

    const msUntilSummary = nextSummary.getTime() - now.getTime();

    this.dailySummaryTimer = setTimeout(() => {
      this.fireDailySummary();
      // Schedule next day's summary
      this.scheduleDailySummary();
    }, msUntilSummary);
  }

  private clearDailySummaryTimer(): void {
    if (this.dailySummaryTimer) {
      clearTimeout(this.dailySummaryTimer);
      this.dailySummaryTimer = null;
    }
  }

  private fireDailySummary(): void {
    if (!this.isDailySummaryEnabled()) return;

    const today = new Date().toDateString();
    if (this.dailySummaryShownToday && this.lastSummaryDate === today) return;

    this.dailySummaryShownToday = true;
    this.lastSummaryDate = today;

    // Get today's data
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTs = startOfToday.getTime();

    const totalTime = this.db.getTotalTrackedTime(startTs, now);
    const breakdown = this.db.getCategoryBreakdown(startTs, now);

    if (totalTime < 60000) {
      // Less than 1 minute tracked, skip notification
      return;
    }

    // Find top category
    const topCategory = breakdown.length > 0
      ? breakdown.reduce((max, c) => c.total_duration > max.total_duration ? c : max, breakdown[0])
      : null;

    // Calculate productivity (based on category settings if available)
    let productiveTime = 0;
    const goalsJson = this.db.getSetting("daily_goals");
    if (goalsJson) {
      try {
        const goals: DailyGoal[] = JSON.parse(goalsJson);
        const goalCategories = new Set(goals.map(g => g.categoryName));
        productiveTime = breakdown
          .filter(c => goalCategories.has(c.category_name))
          .reduce((sum, c) => sum + c.total_duration, 0);
      } catch {
        // Ignore
      }
    }

    const focusPercent = totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;

    let body = `Total: ${formatDuration(totalTime)}`;
    if (topCategory) {
      body += ` • Top: ${topCategory.category_name.replace(/_/g, " ")}`;
    }
    if (productiveTime > 0) {
      body += ` • Focus: ${focusPercent}%`;
    }

    new Notification({
      title: "Daily Summary",
      body,
    }).show();
  }
}
