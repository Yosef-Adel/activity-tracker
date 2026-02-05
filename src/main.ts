import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { TimeTracker } from "./main/tracker";
import { initLogger, log } from "./main/logger";
import {
  getPermissionsStatus,
  requestAccessibility,
  openScreenRecordingPrefs,
} from "./main/permissions";
import {
  initAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
} from "./main/updater";

// Initialize logging before anything else
initLogger();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tracker: TimeTracker | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let pomodoroInterval: ReturnType<typeof setInterval> | null = null;
let lastActivityLabel = "No activity";

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

  // Click toggles the context menu
  tray.on("click", () => {
    const menu = buildTrayMenu();
    tray?.popUpContextMenu(menu);
  });
  tray.on("right-click", () => {
    const menu = buildTrayMenu();
    tray?.popUpContextMenu(menu);
  });
}

function buildTrayMenu(): Electron.Menu {
  const isPaused = tracker?.getStatus()?.isPaused ?? false;

  return Menu.buildFromTemplate([
    {
      label: lastActivityLabel,
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
    { label: `v${app.getVersion()}`, enabled: false },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

const createWindow = () => {
  // Remove the default app menu (File, Edit, View, etc.)
  // On macOS, keep a minimal menu so standard shortcuts (Cmd+Q, Cmd+C/V/X, etc.) work
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }

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

  // Initialize time tracker only if permissions are OK
  const permStatus = getPermissionsStatus();
  if (!permStatus.needsOnboarding) {
    initializeTracker();
  } else {
    log.info("Permissions not granted — waiting for onboarding");
  }

  // Create system tray
  createTray();

  // Initialize auto-updater (only in packaged builds)
  if (app.isPackaged) {
    initAutoUpdater((status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-status", status);
      }
    });
  }
};

async function initializeTracker() {
  tracker = new TimeTracker();

  tracker.setOnActivityChange((activity) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("activity-changed", activity);
    }

    // Update tray with current activity info
    if (activity) {
      lastActivityLabel = `${activity.appName} — ${activity.categoryName}`;
      tray?.setToolTip(`Activity Tracker — ${activity.appName}`);
    } else {
      lastActivityLabel = "Idle";
      tray?.setToolTip("Activity Tracker — Idle");
    }
  });

  try {
    await tracker.start();
    log.info("Tracker started successfully");

    // Resume pomodoro tray timer if one is active
    const activePomodoro = tracker.getDatabase().getActivePomodoro();
    if (activePomodoro) {
      const remaining = activePomodoro.duration - (Date.now() - activePomodoro.start_time);
      if (remaining > 0) startPomodoroTrayTimer();
    }
  } catch (err) {
    log.error("Failed to start tracker:", err);
  }
}

function startPomodoroTrayTimer() {
  stopPomodoroTrayTimer();
  pomodoroInterval = setInterval(() => {
    const active = tracker?.getDatabase().getActivePomodoro();
    if (!active) {
      stopPomodoroTrayTimer();
      return;
    }
    const elapsed = Date.now() - active.start_time;
    const remaining = Math.max(0, active.duration - elapsed);
    if (remaining <= 0) {
      stopPomodoroTrayTimer();
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    // Show countdown next to the tray icon (macOS shows title inline,
    // Windows/Linux show it in the tooltip)
    tray?.setTitle(timeStr);
    tray?.setToolTip(`Pomodoro: ${timeStr} remaining`);
  }, 1000);
}

function stopPomodoroTrayTimer() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  tray?.setTitle("");
  tray?.setToolTip("Activity Tracker");
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
});

ipcMain.handle("tracker:resume", () => {
  tracker?.resume();
});

// Category queries
ipcMain.handle("tracker:getCategoryColor", (_event, categoryId: number) => {
  return tracker?.getCategorizer().getCategoryColor(categoryId) || "#64748B";
});

ipcMain.handle("tracker:getAllCategories", () => {
  return tracker?.getCategorizer().getAllCategories() || [];
});

// Category CRUD
ipcMain.handle("tracker:getCategories", () => {
  return tracker?.getCategorizer().getAllCategories() || [];
});

ipcMain.handle("tracker:createCategory", (_event, name: string, color: string) => {
  const id = tracker?.getCategorizer().createCategory(name, color);
  return { id };
});

ipcMain.handle("tracker:updateCategory", (_event, id: number, name?: string, color?: string) => {
  tracker?.getCategorizer().updateCategory(id, { name, color });
});

ipcMain.handle("tracker:deleteCategory", (_event, id: number) => {
  tracker?.getCategorizer().deleteCategory(id);
});

// Category rules CRUD
ipcMain.handle("tracker:getCategoryRules", (_event, categoryId: number) => {
  return tracker?.getCategorizer().getCategoryRules(categoryId) || [];
});

ipcMain.handle("tracker:addCategoryRule", (_event, categoryId: number, type: string, pattern: string) => {
  const id = tracker?.getCategorizer().addRule(categoryId, type, pattern);
  return { id };
});

ipcMain.handle("tracker:removeCategoryRule", (_event, ruleId: number) => {
  tracker?.getCategorizer().removeRule(ruleId);
});

ipcMain.handle("tracker:reloadCategories", () => {
  tracker?.reloadCategories();
});

ipcMain.handle("tracker:recategorizeSession", (_event, sessionId: number, categoryId: number) => {
  tracker?.getDatabase().recategorizeSession(sessionId, categoryId);
});

ipcMain.handle("tracker:recategorizeByRule", (_event, ruleType: string, pattern: string, categoryId: number) => {
  return tracker?.getDatabase().recategorizeByRule(ruleType, pattern, categoryId) ?? 0;
});

// Project IPC handlers
ipcMain.handle("tracker:getProjects", () => {
  return tracker?.getDatabase().getProjects() ?? [];
});

ipcMain.handle("tracker:createProject", (_event, name: string, color: string) => {
  return tracker?.getDatabase().createProject(name, color) ?? { id: 0 };
});

ipcMain.handle("tracker:updateProject", (_event, id: number, name?: string, color?: string) => {
  tracker?.getDatabase().updateProject(id, name, color);
});

ipcMain.handle("tracker:deleteProject", (_event, id: number) => {
  tracker?.getDatabase().deleteProject(id);
});

ipcMain.handle("tracker:assignSessionToProject", (_event, sessionId: number, projectId: number) => {
  tracker?.getDatabase().assignSessionToProject(sessionId, projectId);
});

ipcMain.handle("tracker:unassignSessionFromProject", (_event, sessionId: number) => {
  tracker?.getDatabase().unassignSessionFromProject(sessionId);
});

ipcMain.handle("tracker:getShortsTime", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getShortsTime(startTime, endTime) ?? { total_duration: 0, count: 0 };
});

// Delete activity / session / pomodoro
ipcMain.handle("tracker:deleteActivity", (_event, activityId: number) => {
  tracker?.getDatabase().deleteActivity(activityId);
});

ipcMain.handle("tracker:deleteSession", (_event, sessionId: number) => {
  tracker?.getDatabase().deleteSession(sessionId);
});

ipcMain.handle("tracker:deletePomodoro", (_event, pomodoroId: number) => {
  tracker?.getDatabase().deletePomodoro(pomodoroId);
});

// Manual time entry
ipcMain.handle("tracker:createManualEntry", (_event, entry: {
  app_name: string;
  category_id: number;
  start_time: number;
  end_time: number;
  notes?: string;
  window_title?: string;
}) => {
  return tracker?.getDatabase().createManualEntry(entry) ?? 0;
});

// Pomodoro
ipcMain.handle("tracker:startPomodoro", (_event, type: string, duration: number, label?: string) => {
  const id = tracker?.getDatabase().startPomodoro(type as "work" | "short_break" | "long_break", duration, label) ?? 0;
  if (id) startPomodoroTrayTimer();
  return id;
});

ipcMain.handle("tracker:completePomodoro", (_event, pomodoroId: number) => {
  tracker?.getDatabase().completePomodoro(pomodoroId);
  stopPomodoroTrayTimer();
});

ipcMain.handle("tracker:abandonPomodoro", (_event, pomodoroId: number) => {
  tracker?.getDatabase().abandonPomodoro(pomodoroId);
  stopPomodoroTrayTimer();
});

ipcMain.handle("tracker:getPomodoros", (_event, startTime: number, endTime: number) => {
  return tracker?.getDatabase().getPomodorosInRange(startTime, endTime) ?? [];
});

ipcMain.handle("tracker:getActivitiesForPomodoro", (_event, pomodoroId: number) => {
  return tracker?.getDatabase().getActivitiesForPomodoro(pomodoroId) ?? [];
});

ipcMain.handle("tracker:tagActivitiesWithPomodoro", (_event, pomodoroId: number, activityIds: number[]) => {
  tracker?.getDatabase().tagActivitiesWithPomodoro(pomodoroId, activityIds);
});

ipcMain.handle("tracker:getActivePomodoro", () => {
  return tracker?.getDatabase().getActivePomodoro() ?? null;
});

// Permissions IPC handlers
ipcMain.handle("permissions:getStatus", () => {
  return getPermissionsStatus();
});

ipcMain.handle("permissions:requestAccess", () => {
  return requestAccessibility();
});

ipcMain.handle("permissions:openScreenPrefs", () => {
  openScreenRecordingPrefs();
});

ipcMain.handle("permissions:startTracker", async () => {
  if (tracker) return;
  await initializeTracker();
});

// Updater IPC handlers
ipcMain.handle("updater:checkForUpdates", () => checkForUpdates());
ipcMain.handle("updater:downloadUpdate", () => downloadUpdate());
ipcMain.handle("updater:installUpdate", () => installUpdate());
ipcMain.handle("updater:getVersion", () => app.getVersion());

// Shell
ipcMain.handle("shell:openExternal", (_event, url: string) => {
  shell.openExternal(url);
});

// Logger IPC handlers
ipcMain.handle("logger:getLogPath", () => {
  const file = log.transports.file.getFile();
  return file?.path ?? null;
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
  stopPomodoroTrayTimer();
  if (tracker) {
    tracker.shutdown();
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
