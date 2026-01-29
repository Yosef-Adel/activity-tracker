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

// IPC Handlers
ipcMain.handle("tracker:getStatus", () => {
  return tracker?.getStatus() || null;
});

ipcMain.handle("tracker:getAppUsage", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getAppUsage(startTime, endTime) || [];
});

ipcMain.handle("tracker:getCategoryBreakdown", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getCategoryBreakdown(startTime, endTime) || [];
});

ipcMain.handle("tracker:getProjectTime", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getProjectTime(startTime, endTime) || [];
});

ipcMain.handle("tracker:getDomainUsage", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getDomainUsage(startTime, endTime) || [];
});

ipcMain.handle("tracker:getHourlyPattern", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getHourlyPattern(startTime, endTime) || [];
});

ipcMain.handle("tracker:getDailyTotals", (_event, days: number) => {
  return tracker?.getDatabase().getDailyTotals(days) || [];
});

ipcMain.handle("tracker:getTotalTime", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getTotalTrackedTime(startTime, endTime) || 0;
});

ipcMain.handle("tracker:getActivities", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getActivitiesInRange(startTime, endTime) || [];
});

ipcMain.handle("tracker:getSessions", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getSessionsWithActivities(startTime, endTime) || [];
});

ipcMain.handle("tracker:getCategoryColor", (_event, category: string) => {
  return tracker?.getCategorizer().getCategoryColor(category as never) || "#64748B";
});

ipcMain.handle("tracker:getAllCategories", () => {
  return tracker?.getCategorizer().getAllCategories() || [];
});

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (tracker) {
    tracker.shutdown();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (tracker) {
    tracker.shutdown();
  }
});
