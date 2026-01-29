import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { TimeTracker } from "./main/tracker";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tracker: TimeTracker | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createTray() {
  // In dev: icon is in src/assets relative to project root
  // In production: icon is in resources (via extraResource in forge config)
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "trayIconTemplate.png")
    : path.join(app.getAppPath(), "src/assets/trayIconTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Activity Tracker");

  // Click tray icon to show/hide window
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  updateTrayMenu();
}

function updateTrayMenu(activityLabel?: string) {
  if (!tray) return;

  const isPaused = tracker?.getStatus()?.isPaused ?? false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: activityLabel || "No activity",
      enabled: false,
    },
    { type: "separator" },
    {
      label: isPaused ? "Resume Tracking" : "Pause Tracking",
      click: () => {
        if (isPaused) {
          tracker?.resume();
        } else {
          tracker?.pause();
        }
        updateTrayMenu(activityLabel);
      },
    },
    {
      label: "Show Window",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

const createWindow = () => {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(app.getAppPath(), "src/assets/icon.png");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
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

  // Hide window instead of closing (app stays in tray)
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Initialize time tracker
  initializeTracker();

  // Create system tray
  createTray();
};

async function initializeTracker() {
  tracker = new TimeTracker();

  tracker.setOnActivityChange((activity) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("activity-changed", activity);
    }

    // Update tray with current activity info
    if (activity) {
      const label = `${activity.appName} — ${activity.category}`;
      tray?.setToolTip(`Activity Tracker — ${activity.appName}`);
      updateTrayMenu(label);
    } else {
      tray?.setToolTip("Activity Tracker — Idle");
      updateTrayMenu("Idle");
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

// Pause/resume tracking
ipcMain.handle("tracker:pause", () => {
  tracker?.pause();
  updateTrayMenu();
});

ipcMain.handle("tracker:resume", () => {
  tracker?.resume();
  updateTrayMenu();
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

// Don't quit when window is closed — app stays in tray
app.on("window-all-closed", () => {
  // Do nothing — tray keeps the app alive
});

// macOS: show window when clicking dock icon
app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

// Final cleanup before app exits to flush pending database writes
app.on("before-quit", () => {
  isQuitting = true;
  if (tracker) {
    tracker.shutdown();
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
