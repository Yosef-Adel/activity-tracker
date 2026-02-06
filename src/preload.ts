import { contextBridge, ipcRenderer } from "electron";

export interface CurrentActivity {
  appName: string;
  title: string;
  url: string | null;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  context: Record<string, unknown>;
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

export interface AppUsage {
  app_name: string;
  total_duration: number;
  session_count: number;
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  category_color: string;
  productivity_type: string;
  total_duration: number;
  session_count: number;
}

export interface ProjectTime {
  project_name: string;
  total_duration: number;
  session_count: number;
}

export interface PomodoroRecord {
  id: number;
  type: string;
  start_time: number;
  end_time: number | null;
  duration: number;
  completed: number;
  label: string | null;
  category_id: number | null;
  notes: string | null;
}

export interface ActivePomodoro {
  id: number;
  type: string;
  start_time: number;
  duration: number;
  label: string | null;
  category_id: number | null;
  notes: string | null;
}

export interface DomainUsage {
  domain: string;
  total_duration: number;
  session_count: number;
}

export interface HourlyPattern {
  hour: string;
  category_name: string;
  category_color: string;
  total_duration: number;
}

export interface DailyTotal {
  date: string;
  total_duration: number;
  session_count: number;
}

export interface ActivityRecord {
  id: number;
  session_id: number | null;
  app_name: string;
  window_title: string;
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
  created_at: string;
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

export interface CategoryInfo {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  isPassive: boolean;
  productivityType: "productive" | "neutral" | "distraction";
}

export interface CategoryRule {
  id: number;
  type: string;
  pattern: string;
}

export interface PermissionsStatus {
  platform: "darwin" | "other";
  accessibility: boolean;
  screenRecording: boolean;
  needsOnboarding: boolean;
}

export interface UpdateStatus {
  state: "checking" | "available" | "not-available" | "error";
  version?: string;
  downloadUrl?: string;
  error?: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Tracker status
  getTrackerStatus: (): Promise<TrackerStatus | null> =>
    ipcRenderer.invoke("tracker:getStatus"),

  // Analytics
  getAppUsage: (startTime: number, endTime: number): Promise<AppUsage[]> =>
    ipcRenderer.invoke("tracker:getAppUsage", startTime, endTime),

  getCategoryBreakdown: (startTime: number, endTime: number): Promise<CategoryBreakdown[]> =>
    ipcRenderer.invoke("tracker:getCategoryBreakdown", startTime, endTime),

  getProjectTime: (startTime: number, endTime: number): Promise<ProjectTime[]> =>
    ipcRenderer.invoke("tracker:getProjectTime", startTime, endTime),

  getDomainUsage: (startTime: number, endTime: number): Promise<DomainUsage[]> =>
    ipcRenderer.invoke("tracker:getDomainUsage", startTime, endTime),

  getHourlyPattern: (startTime: number, endTime: number): Promise<HourlyPattern[]> =>
    ipcRenderer.invoke("tracker:getHourlyPattern", startTime, endTime),

  getDailyTotals: (days: number): Promise<DailyTotal[]> =>
    ipcRenderer.invoke("tracker:getDailyTotals", days),

  getTotalTime: (startTime: number, endTime: number): Promise<number> =>
    ipcRenderer.invoke("tracker:getTotalTime", startTime, endTime),

  getActivities: (startTime: number, endTime: number): Promise<ActivityRecord[]> =>
    ipcRenderer.invoke("tracker:getActivities", startTime, endTime),

  getSessions: (startTime: number, endTime: number): Promise<SessionWithActivities[]> =>
    ipcRenderer.invoke("tracker:getSessions", startTime, endTime),

  // Pause/Resume
  pauseTracking: (): Promise<void> =>
    ipcRenderer.invoke("tracker:pause"),

  resumeTracking: (): Promise<void> =>
    ipcRenderer.invoke("tracker:resume"),

  // Categories
  getCategoryColor: (categoryId: number): Promise<string> =>
    ipcRenderer.invoke("tracker:getCategoryColor", categoryId),

  getAllCategories: (): Promise<CategoryInfo[]> =>
    ipcRenderer.invoke("tracker:getAllCategories"),

  // Category CRUD
  getCategories: (): Promise<CategoryInfo[]> =>
    ipcRenderer.invoke("tracker:getCategories"),

  createCategory: (name: string, color: string): Promise<{ id: number }> =>
    ipcRenderer.invoke("tracker:createCategory", name, color),

  updateCategory: (id: number, name?: string, color?: string, isPassive?: boolean, productivityType?: string): Promise<void> =>
    ipcRenderer.invoke("tracker:updateCategory", id, name, color, isPassive, productivityType),

  deleteCategory: (id: number): Promise<void> =>
    ipcRenderer.invoke("tracker:deleteCategory", id),

  // Category rules CRUD
  getCategoryRules: (categoryId: number): Promise<CategoryRule[]> =>
    ipcRenderer.invoke("tracker:getCategoryRules", categoryId),

  addCategoryRule: (categoryId: number, type: string, pattern: string): Promise<{ id: number }> =>
    ipcRenderer.invoke("tracker:addCategoryRule", categoryId, type, pattern),

  removeCategoryRule: (ruleId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:removeCategoryRule", ruleId),

  reloadCategories: (): Promise<void> =>
    ipcRenderer.invoke("tracker:reloadCategories"),

  recategorizeSession: (sessionId: number, categoryId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:recategorizeSession", sessionId, categoryId),

  recategorizeByRule: (ruleType: string, pattern: string, categoryId: number): Promise<number> =>
    ipcRenderer.invoke("tracker:recategorizeByRule", ruleType, pattern, categoryId),

  // Projects
  getProjects: (): Promise<Array<{ id: number; name: string; color: string }>> =>
    ipcRenderer.invoke("tracker:getProjects"),

  createProject: (name: string, color: string): Promise<{ id: number }> =>
    ipcRenderer.invoke("tracker:createProject", name, color),

  updateProject: (id: number, name?: string, color?: string): Promise<void> =>
    ipcRenderer.invoke("tracker:updateProject", id, name, color),

  deleteProject: (id: number): Promise<void> =>
    ipcRenderer.invoke("tracker:deleteProject", id),

  assignSessionToProject: (sessionId: number, projectId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:assignSessionToProject", sessionId, projectId),

  unassignSessionFromProject: (sessionId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:unassignSessionFromProject", sessionId),

  // Excluded apps
  getExcludedApps: (): Promise<Array<{ id: number; app_name: string }>> =>
    ipcRenderer.invoke("tracker:getExcludedApps"),

  addExcludedApp: (appName: string): Promise<{ id: number }> =>
    ipcRenderer.invoke("tracker:addExcludedApp", appName),

  removeExcludedApp: (id: number): Promise<void> =>
    ipcRenderer.invoke("tracker:removeExcludedApp", id),

  getShortsTime: (startTime: number, endTime: number): Promise<{ total_duration: number; count: number }> =>
    ipcRenderer.invoke("tracker:getShortsTime", startTime, endTime),

  // Delete activity / session / pomodoro
  deleteActivity: (activityId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:deleteActivity", activityId),

  deleteSession: (sessionId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:deleteSession", sessionId),

  deletePomodoro: (pomodoroId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:deletePomodoro", pomodoroId),

  // Manual entries
  createManualEntry: (entry: {
    app_name: string;
    category_id: number;
    start_time: number;
    end_time: number;
    notes?: string;
    window_title?: string;
  }): Promise<number> =>
    ipcRenderer.invoke("tracker:createManualEntry", entry),

  // Pomodoro
  startPomodoro: (type: string, duration: number, label?: string, categoryId?: number, notes?: string): Promise<number> =>
    ipcRenderer.invoke("tracker:startPomodoro", type, duration, label, categoryId, notes),

  completePomodoro: (pomodoroId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:completePomodoro", pomodoroId),

  abandonPomodoro: (pomodoroId: number): Promise<void> =>
    ipcRenderer.invoke("tracker:abandonPomodoro", pomodoroId),

  getPomodoros: (startTime: number, endTime: number): Promise<PomodoroRecord[]> =>
    ipcRenderer.invoke("tracker:getPomodoros", startTime, endTime),

  getActivitiesForPomodoro: (pomodoroId: number): Promise<ActivityRecord[]> =>
    ipcRenderer.invoke("tracker:getActivitiesForPomodoro", pomodoroId),

  tagActivitiesWithPomodoro: (pomodoroId: number, activityIds: number[]): Promise<void> =>
    ipcRenderer.invoke("tracker:tagActivitiesWithPomodoro", pomodoroId, activityIds),

  getActivePomodoro: (): Promise<ActivePomodoro | null> =>
    ipcRenderer.invoke("tracker:getActivePomodoro"),

  flushActivities: (): Promise<void> =>
    ipcRenderer.invoke("tracker:flush"),

  // Activity change listener
  onActivityChanged: (callback: (activity: CurrentActivity | null) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      activity: CurrentActivity | null,
    ) => {
      callback(activity);
    };
    ipcRenderer.on("activity-changed", subscription);
    return () => {
      ipcRenderer.removeListener("activity-changed", subscription);
    };
  },

  // Permissions
  permissions: {
    getStatus: (): Promise<PermissionsStatus> =>
      ipcRenderer.invoke("permissions:getStatus"),
    requestAccessibility: (): Promise<boolean> =>
      ipcRenderer.invoke("permissions:requestAccess"),
    openScreenRecordingPrefs: (): Promise<void> =>
      ipcRenderer.invoke("permissions:openScreenPrefs"),
    startTracker: (): Promise<void> =>
      ipcRenderer.invoke("permissions:startTracker"),
  },

  // Updater
  updater: {
    checkForUpdates: (): Promise<void> =>
      ipcRenderer.invoke("updater:checkForUpdates"),
    downloadUpdate: (): Promise<void> =>
      ipcRenderer.invoke("updater:downloadUpdate"),
    installUpdate: (): Promise<void> =>
      ipcRenderer.invoke("updater:installUpdate"),
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke("updater:getVersion"),
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
      const subscription = (
        _event: Electron.IpcRendererEvent,
        status: UpdateStatus,
      ) => {
        callback(status);
      };
      ipcRenderer.on("update-status", subscription);
      return () => {
        ipcRenderer.removeListener("update-status", subscription);
      };
    },
  },

  // Logger
  logger: {
    getLogPath: (): Promise<string | null> =>
      ipcRenderer.invoke("logger:getLogPath"),
  },

  // Idle timeout
  getIdleTimeout: (): Promise<number> =>
    ipcRenderer.invoke("tracker:getIdleTimeout"),

  setIdleTimeout: (seconds: number): Promise<void> =>
    ipcRenderer.invoke("tracker:setIdleTimeout", seconds),

  // Tracking interval
  getTrackingInterval: (): Promise<number> =>
    ipcRenderer.invoke("tracker:getTrackingInterval"),

  setTrackingInterval: (ms: number): Promise<void> =>
    ipcRenderer.invoke("tracker:setTrackingInterval", ms),

  // Clear all data
  clearAllData: (): Promise<void> =>
    ipcRenderer.invoke("tracker:clearAllData"),

  // Launch at startup
  getLoginItemSettings: (): Promise<{ openAtLogin: boolean }> =>
    ipcRenderer.invoke("app:getLoginItemSettings"),

  setLoginItemSettings: (openAtLogin: boolean): Promise<void> =>
    ipcRenderer.invoke("app:setLoginItemSettings", openAtLogin),

  // Generic settings
  getSetting: (key: string): Promise<string | null> =>
    ipcRenderer.invoke("tracker:getSetting", key),

  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("tracker:setSetting", key, value),

  // Shell
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("shell:openExternal", url),

  // Data Export/Import
  exportToJSON: (): Promise<{ success: boolean; cancelled?: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke("data:exportJSON"),

  importFromJSON: (): Promise<{ success: boolean; cancelled?: boolean; imported?: number; error?: string }> =>
    ipcRenderer.invoke("data:importJSON"),
});
