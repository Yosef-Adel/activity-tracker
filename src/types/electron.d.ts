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
  total_duration: number;
  session_count: number;
}

export interface ProjectTime {
  project_name: string;
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
  updateCategory: (id: number, name?: string, color?: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Category rules CRUD
  getCategoryRules: (categoryId: number) => Promise<CategoryRule[]>;
  addCategoryRule: (categoryId: number, type: string, pattern: string) => Promise<{ id: number }>;
  removeCategoryRule: (ruleId: number) => Promise<void>;
  reloadCategories: () => Promise<void>;

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
