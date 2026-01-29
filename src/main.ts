import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { TimeTracker } from "./main/tracker";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tracker: TimeTracker | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Initialize time tracker
  initializeTracker();
};

async function initializeTracker() {
  tracker = new TimeTracker();

  tracker.setOnActivityChange((activity) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("activity-changed", activity);
    }
  });

  await tracker.start();
}

// IPC Handlers - expose tracker data to the renderer process

// For displaying tracker state (running/paused) and current activity in the UI
ipcMain.handle("tracker:getStatus", () => {
  return tracker?.getStatus() || null;
});

// For showing time spent per application (e.g., "VS Code: 2h, Chrome: 1h")
ipcMain.handle("tracker:getAppUsage", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getAppUsage(startTime, endTime) || [];
});

// For pie charts showing time distribution by category (development, social, etc.)
ipcMain.handle("tracker:getCategoryBreakdown", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getCategoryBreakdown(startTime, endTime) || [];
});

// For showing time spent on detected projects (VS Code workspaces, GitHub repos)
ipcMain.handle("tracker:getProjectTime", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getProjectTime(startTime, endTime) || [];
});

// For showing time spent per website domain (github.com, stackoverflow.com, etc.)
ipcMain.handle("tracker:getDomainUsage", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getDomainUsage(startTime, endTime) || [];
});

// For heatmaps showing which hours of the day are most productive
ipcMain.handle("tracker:getHourlyPattern", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getHourlyPattern(startTime, endTime) || [];
});

// For bar charts showing daily totals over time (trends page)
ipcMain.handle("tracker:getDailyTotals", (_event, days: number) => {
  return tracker?.getDatabase().getDailyTotals(days) || [];
});

// For displaying "Total time today: X hours" summary
ipcMain.handle("tracker:getTotalTime", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getTotalTrackedTime(startTime, endTime) || 0;
});

// For the activities list/table showing individual activity records
ipcMain.handle("tracker:getActivities", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getActivitiesInRange(startTime, endTime) || [];
});

// For session-based view grouping activities into work sessions
ipcMain.handle("tracker:getSessions", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getSessionsWithActivities(startTime, endTime) || [];
});

// For consistent category colors across all charts
ipcMain.handle("tracker:getCategoryColor", (_event, category: string) => {
  return tracker?.getCategorizer().getCategoryColor(category as never) || "#64748B";
});

// For populating category filter dropdowns
ipcMain.handle("tracker:getAllCategories", () => {
  return tracker?.getCategorizer().getAllCategories() || [];
});

// App lifecycle events

// Create the main window when Electron is ready
app.on("ready", createWindow);

// Cleanup tracker and quit when all windows are closed (except macOS which keeps apps in dock)
app.on("window-all-closed", () => {
  if (tracker) {
    tracker.shutdown();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS: re-create window when clicking dock icon with no windows open
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Final cleanup before app exits to flush pending database writes
app.on("before-quit", () => {
  if (tracker) {
    tracker.shutdown();
  }
});
