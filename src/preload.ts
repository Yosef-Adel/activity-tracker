import { contextBridge, ipcRenderer } from "electron";

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
  session_id: number | null;
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

  // Categories
  getCategoryColor: (category: string): Promise<string> =>
    ipcRenderer.invoke("tracker:getCategoryColor", category),

  getAllCategories: (): Promise<string[]> =>
    ipcRenderer.invoke("tracker:getAllCategories"),

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
});
