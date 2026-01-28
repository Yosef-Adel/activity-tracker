export interface CurrentActivity {
  appName: string;
  title: string;
  url: string | null;
  category: string;
  context: Record<string, unknown>;
}

export interface TrackerStatus {
  isRunning: boolean;
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
  category: string;
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
  category: string;
  total_duration: number;
}

export interface DailyTotal {
  date: string;
  total_duration: number;
  session_count: number;
}

export interface ActivityRecord {
  id: number;
  app_name: string;
  window_title: string;
  url: string | null;
  category: string;
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

  // Categories
  getCategoryColor: (category: string) => Promise<string>;
  getAllCategories: () => Promise<string[]>;

  // Activity change listener
  onActivityChanged: (callback: (activity: CurrentActivity | null) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
