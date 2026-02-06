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
  productivity_type: "productive" | "neutral" | "distraction";
  total_duration: number;
  session_count: number;
}

export interface ProjectInfo {
  id: number;
  name: string;
  color: string;
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

export interface ProjectTime {
  project_id: number;
  project_name: string;
  project_color: string;
  total_duration: number;
  session_count: number;
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
  is_manual: number;
  notes: string | null;
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

export interface ExcludedApp {
  id: number;
  app_name: string;
}

export interface PermissionsStatus {
  platform: "darwin" | "other";
  accessibility: boolean;
  screenRecording: boolean;
  needsOnboarding: boolean;
}

export interface UpdateStatus {
  state:
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  version?: string;
  percent?: number;
  error?: string;
}

export interface ElectronAPI {
  // Tracker status
  getTrackerStatus: () => Promise<TrackerStatus | null>;

  // Analytics
  getAppUsage: (startTime: number, endTime: number) => Promise<AppUsage[]>;
  getCategoryBreakdown: (startTime: number, endTime: number) => Promise<CategoryBreakdown[]>;
  getProjectTime: (startTime: number, endTime: number) => Promise<ProjectTime[]>;
  getDomainUsage: (startTime: number, endTime: number) => Promise<DomainUsage[]>;
  getHourlyPattern: (startTime: number, endTime: number) => Promise<HourlyPattern[]>;
  getDailyTotals: (days: number) => Promise<DailyTotal[]>;
  getTotalTime: (startTime: number, endTime: number) => Promise<number>;
  getActivities: (startTime: number, endTime: number) => Promise<ActivityRecord[]>;
  getSessions: (startTime: number, endTime: number) => Promise<SessionWithActivities[]>;

  // Pause/Resume
  pauseTracking: () => Promise<void>;
  resumeTracking: () => Promise<void>;

  // Categories
  getCategoryColor: (categoryId: number) => Promise<string>;
  getAllCategories: () => Promise<CategoryInfo[]>;

  // Category CRUD
  getCategories: () => Promise<CategoryInfo[]>;
  createCategory: (name: string, color: string) => Promise<{ id: number }>;
  updateCategory: (id: number, name?: string, color?: string, isPassive?: boolean, productivityType?: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Category rules CRUD
  getCategoryRules: (categoryId: number) => Promise<CategoryRule[]>;
  addCategoryRule: (categoryId: number, type: string, pattern: string) => Promise<{ id: number }>;
  removeCategoryRule: (ruleId: number) => Promise<void>;
  reloadCategories: () => Promise<void>;

  // Recategorize
  recategorizeSession: (sessionId: number, categoryId: number) => Promise<void>;
  recategorizeByRule: (ruleType: string, pattern: string, categoryId: number) => Promise<number>;

  // Projects
  getProjects: () => Promise<ProjectInfo[]>;
  createProject: (name: string, color: string) => Promise<{ id: number }>;
  updateProject: (id: number, name?: string, color?: string) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  assignSessionToProject: (sessionId: number, projectId: number) => Promise<void>;
  unassignSessionFromProject: (sessionId: number) => Promise<void>;
  // Excluded apps
  getExcludedApps: () => Promise<ExcludedApp[]>;
  addExcludedApp: (appName: string) => Promise<{ id: number }>;
  removeExcludedApp: (id: number) => Promise<void>;

  getShortsTime: (startTime: number, endTime: number) => Promise<{ total_duration: number; count: number }>;

  // Delete activity / session / pomodoro
  deleteActivity: (activityId: number) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
  deletePomodoro: (pomodoroId: number) => Promise<void>;

  // Manual entries
  createManualEntry: (entry: {
    app_name: string;
    category_id: number;
    start_time: number;
    end_time: number;
    notes?: string;
    window_title?: string;
  }) => Promise<number>;

  // Pomodoro
  startPomodoro: (type: string, duration: number, label?: string, categoryId?: number, notes?: string) => Promise<number>;
  completePomodoro: (pomodoroId: number) => Promise<void>;
  abandonPomodoro: (pomodoroId: number) => Promise<void>;
  getPomodoros: (startTime: number, endTime: number) => Promise<PomodoroRecord[]>;
  getActivitiesForPomodoro: (pomodoroId: number) => Promise<ActivityRecord[]>;
  tagActivitiesWithPomodoro: (pomodoroId: number, activityIds: number[]) => Promise<void>;
  getActivePomodoro: () => Promise<ActivePomodoro | null>;
  flushActivities: () => Promise<void>;

  // Activity change listener
  onActivityChanged: (callback: (activity: CurrentActivity | null) => void) => () => void;

  // Permissions
  permissions: {
    getStatus(): Promise<PermissionsStatus>;
    requestAccessibility(): Promise<boolean>;
    openScreenRecordingPrefs(): Promise<void>;
    startTracker(): Promise<void>;
  };

  // Updater
  updater: {
    checkForUpdates(): Promise<void>;
    downloadUpdate(): Promise<void>;
    installUpdate(): Promise<void>;
    getVersion(): Promise<string>;
    onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;
  };

  // Logger
  logger: {
    getLogPath(): Promise<string | null>;
  };

  // Idle timeout
  getIdleTimeout: () => Promise<number>;
  setIdleTimeout: (seconds: number) => Promise<void>;

  // Tracking interval
  getTrackingInterval: () => Promise<number>;
  setTrackingInterval: (ms: number) => Promise<void>;

  // Clear all data
  clearAllData: () => Promise<void>;

  // Launch at startup
  getLoginItemSettings: () => Promise<{ openAtLogin: boolean }>;
  setLoginItemSettings: (openAtLogin: boolean) => Promise<void>;

  // Generic settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Shell
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
