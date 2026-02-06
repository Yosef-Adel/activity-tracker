import { useEffect, useState } from "react";
import { Card } from "../components";
import type {
  CategoryInfo,
  CategoryRule,
  ProjectInfo,
  ExcludedApp,
} from "../types/electron";

const COLOR_PALETTE = [
  "#8b5cf6",
  "#a855f7",
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#f43f5e",
  "#ec4899",
];

const RULE_TYPES = ["app", "domain", "keyword", "domain_keyword", "file_path"];

interface CategoryFormData {
  name: string;
  color: string;
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CategoryFormData;
  onSave: (data: CategoryFormData) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || COLOR_PALETTE[0]);

  return (
    <div className="space-y-3 py-3">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-grey-500 mb-1 block">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. gaming"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-grey-600 outline-none focus:border-white/20"
          autoFocus
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-grey-500 mb-1.5 block">
          Color
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-all ${
                color === c
                  ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[#111113] scale-110"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            name.trim() &&
            onSave({
              name: name.trim().toLowerCase().replace(/\s+/g, "_"),
              color,
            })
          }
          disabled={!name.trim()}
          className="px-3 py-1 text-xs rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-dark"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function AddRuleForm({
  onAdd,
  onCancel,
}: {
  onAdd: (type: string, pattern: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState("domain");
  const [pattern, setPattern] = useState("");

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white outline-none"
      >
        {RULE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        placeholder="e.g. github.com"
        className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white placeholder:text-grey-600 outline-none focus:border-white/20"
        onKeyDown={(e) => {
          if (e.key === "Enter" && pattern.trim()) {
            onAdd(type, pattern.trim());
            setPattern("");
          }
        }}
      />
      <button
        onClick={() => {
          if (pattern.trim()) {
            onAdd(type, pattern.trim());
            setPattern("");
          }
        }}
        disabled={!pattern.trim()}
        className="px-2 py-1 text-xs rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Add
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-xs text-grey-500 hover:text-white transition-all"
      >
        Cancel
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rulesMap, setRulesMap] = useState<Record<number, CategoryRule[]>>({});
  const [addingRuleForId, setAddingRuleForId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Version state
  const [appVersion, setAppVersion] = useState("...");

  // Project state
  const [projectList, setProjectList] = useState<ProjectInfo[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(
    null,
  );

  // Excluded apps state
  const [excludedApps, setExcludedApps] = useState<ExcludedApp[]>([]);
  const [isExcludedExpanded, setIsExcludedExpanded] = useState(false);
  const [isAddingExcluded, setIsAddingExcluded] = useState(false);
  const [newExcludedName, setNewExcludedName] = useState("");

  // Launch at startup state
  const [launchAtStartup, setLaunchAtStartup] = useState(false);

  const fetchLoginItemSettings = async () => {
    const settings = await window.electronAPI.getLoginItemSettings();
    setLaunchAtStartup(settings.openAtLogin);
  };

  const handleToggleLaunchAtStartup = async () => {
    const newValue = !launchAtStartup;
    await window.electronAPI.setLoginItemSettings(newValue);
    setLaunchAtStartup(newValue);
  };

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [breakRemindersEnabled, setBreakRemindersEnabled] = useState(true);
  const [breakIntervalMinutes, setBreakIntervalMinutes] = useState(60);
  const [pomodoroNotificationsEnabled, setPomodoroNotificationsEnabled] = useState(true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const [dailySummaryHour, setDailySummaryHour] = useState(18);

  const fetchNotificationSettings = async () => {
    const [notifEnabled, breakEnabled, breakInterval, pomodoroEnabled, summaryEnabled, summaryHour] = await Promise.all([
      window.electronAPI.getSetting("notifications_enabled"),
      window.electronAPI.getSetting("break_reminders_enabled"),
      window.electronAPI.getSetting("break_interval_minutes"),
      window.electronAPI.getSetting("pomodoro_notifications_enabled"),
      window.electronAPI.getSetting("daily_summary_enabled"),
      window.electronAPI.getSetting("daily_summary_hour"),
    ]);
    setNotificationsEnabled(notifEnabled !== "false");
    setBreakRemindersEnabled(breakEnabled !== "false");
    setBreakIntervalMinutes(breakInterval ? parseInt(breakInterval, 10) || 60 : 60);
    setPomodoroNotificationsEnabled(pomodoroEnabled !== "false");
    setDailySummaryEnabled(summaryEnabled !== "false");
    setDailySummaryHour(summaryHour ? parseInt(summaryHour, 10) || 18 : 18);
  };

  const handleToggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    await window.electronAPI.setSetting("notifications_enabled", String(newValue));
    setNotificationsEnabled(newValue);
  };

  const handleToggleBreakReminders = async () => {
    const newValue = !breakRemindersEnabled;
    await window.electronAPI.setSetting("break_reminders_enabled", String(newValue));
    setBreakRemindersEnabled(newValue);
  };

  const handleBreakIntervalChange = async (minutes: number) => {
    await window.electronAPI.setSetting("break_interval_minutes", String(minutes));
    setBreakIntervalMinutes(minutes);
  };

  const handleTogglePomodoroNotifications = async () => {
    const newValue = !pomodoroNotificationsEnabled;
    await window.electronAPI.setSetting("pomodoro_notifications_enabled", String(newValue));
    setPomodoroNotificationsEnabled(newValue);
  };

  const handleToggleDailySummary = async () => {
    const newValue = !dailySummaryEnabled;
    await window.electronAPI.setSetting("daily_summary_enabled", String(newValue));
    setDailySummaryEnabled(newValue);
  };

  const handleDailySummaryHourChange = async (hour: number) => {
    await window.electronAPI.setSetting("daily_summary_hour", String(hour));
    setDailySummaryHour(hour);
  };

  // Idle timeout state
  const [idleTimeout, setIdleTimeout] = useState(120);

  const fetchIdleTimeout = async () => {
    const seconds = await window.electronAPI.getIdleTimeout();
    setIdleTimeout(seconds);
  };

  const handleIdleTimeoutChange = async (seconds: number) => {
    await window.electronAPI.setIdleTimeout(seconds);
    setIdleTimeout(seconds);
  };

  // Tracking interval state
  const [trackingInterval, setTrackingInterval] = useState(5000);

  const fetchTrackingInterval = async () => {
    const ms = await window.electronAPI.getTrackingInterval();
    setTrackingInterval(ms);
  };

  const handleTrackingIntervalChange = async (ms: number) => {
    await window.electronAPI.setTrackingInterval(ms);
    setTrackingInterval(ms);
  };

  // Clear data state
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = async () => {
    setIsClearing(true);
    await window.electronAPI.clearAllData();
    setIsClearing(false);
    setIsConfirmingClear(false);
  };

  const fetchExcludedApps = async () => {
    const apps = await window.electronAPI.getExcludedApps();
    setExcludedApps(apps);
  };

  const handleAddExcludedApp = async () => {
    const name = newExcludedName.trim();
    if (!name) return;
    await window.electronAPI.addExcludedApp(name);
    setNewExcludedName("");
    setIsAddingExcluded(false);
    await fetchExcludedApps();
  };

  const handleRemoveExcludedApp = async (id: number) => {
    await window.electronAPI.removeExcludedApp(id);
    await fetchExcludedApps();
  };

  const fetchCategories = async () => {
    const cats = await window.electronAPI.getCategories();
    setCategories(cats);
  };

  const fetchProjects = async () => {
    const projs = await window.electronAPI.getProjects();
    setProjectList(projs);
  };

  useEffect(() => {
    fetchCategories();
    fetchProjects();
    fetchExcludedApps();
    fetchLoginItemSettings();
    fetchIdleTimeout();
    fetchTrackingInterval();
    fetchNotificationSettings();
    window.electronAPI.updater.getVersion().then(setAppVersion);
  }, []);

  const fetchRules = async (categoryId: number) => {
    const rules = await window.electronAPI.getCategoryRules(categoryId);
    setRulesMap((prev) => ({ ...prev, [categoryId]: rules }));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!rulesMap[id]) {
        fetchRules(id);
      }
    }
  };

  const handleCreate = async (data: CategoryFormData) => {
    await window.electronAPI.createCategory(data.name, data.color);
    await window.electronAPI.reloadCategories();
    await fetchCategories();
    setIsAdding(false);
  };

  const handleUpdate = async (id: number, data: CategoryFormData) => {
    await window.electronAPI.updateCategory(id, data.name, data.color);
    await window.electronAPI.reloadCategories();
    await fetchCategories();
    setEditingId(null);
  };

  const handleTogglePassive = async (id: number, current: boolean) => {
    await window.electronAPI.updateCategory(id, undefined, undefined, !current);
    await window.electronAPI.reloadCategories();
    await fetchCategories();
  };

  const handleProductivityChange = async (
    id: number,
    type: "productive" | "neutral" | "distraction",
  ) => {
    await window.electronAPI.updateCategory(
      id,
      undefined,
      undefined,
      undefined,
      type,
    );
    await window.electronAPI.reloadCategories();
    await fetchCategories();
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteCategory(id);
    await window.electronAPI.reloadCategories();
    await fetchCategories();
    setDeletingId(null);
    if (expandedId === id) setExpandedId(null);
  };

  const handleAddRule = async (
    categoryId: number,
    type: string,
    pattern: string,
  ) => {
    await window.electronAPI.addCategoryRule(categoryId, type, pattern);
    await window.electronAPI.reloadCategories();
    await fetchRules(categoryId);
    setAddingRuleForId(null);
  };

  const handleRemoveRule = async (categoryId: number, ruleId: number) => {
    await window.electronAPI.removeCategoryRule(ruleId);
    await window.electronAPI.reloadCategories();
    await fetchRules(categoryId);
  };

  // Project handlers
  const handleCreateProject = async (data: CategoryFormData) => {
    await window.electronAPI.createProject(data.name, data.color);
    await fetchProjects();
    setIsAddingProject(false);
  };

  const handleUpdateProject = async (id: number, data: CategoryFormData) => {
    await window.electronAPI.updateProject(id, data.name, data.color);
    await fetchProjects();
    setEditingProjectId(null);
  };

  const handleDeleteProject = async (id: number) => {
    await window.electronAPI.deleteProject(id);
    await fetchProjects();
    setDeletingProjectId(null);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* General Settings */}
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">
            General
          </p>
          <div className="space-y-4">
            {/* Launch at Startup — functional */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">
                  Launch at Startup
                </p>
                <p className="text-xs text-grey-500">Start when you log in</p>
              </div>
              <button
                onClick={handleToggleLaunchAtStartup}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  launchAtStartup ? "bg-primary" : "bg-grey-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    launchAtStartup ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Idle Timeout — functional */}
            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Idle Timeout</p>
                <p className="text-xs text-grey-500">Pause after inactivity</p>
              </div>
              <select
                value={idleTimeout}
                onChange={(e) =>
                  handleIdleTimeoutChange(Number(e.target.value))
                }
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
              >
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1800}>30 minutes</option>
              </select>
            </div>

            {/* Tracking Interval — functional */}
            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Check Interval</p>
                <p className="text-xs text-grey-500">How often to track</p>
              </div>
              <select
                value={trackingInterval}
                onChange={(e) =>
                  handleTrackingIntervalChange(Number(e.target.value))
                }
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
              >
                <option value={2000}>2 seconds</option>
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={15000}>15 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">
            Notifications
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">
                  Show Notifications
                </p>
                <p className="text-xs text-grey-500">
                  Goal alerts & break reminders
                </p>
              </div>
              <button
                onClick={handleToggleNotifications}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notificationsEnabled ? "bg-primary" : "bg-grey-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    notificationsEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">
                  Break Reminders
                </p>
                <p className="text-xs text-grey-500">Remind to take breaks</p>
              </div>
              <button
                onClick={handleToggleBreakReminders}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  breakRemindersEnabled ? "bg-primary" : "bg-grey-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    breakRemindersEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Break Interval</p>
                <p className="text-xs text-grey-500">Time between breaks</p>
              </div>
              <select
                value={breakIntervalMinutes}
                onChange={(e) =>
                  handleBreakIntervalChange(Number(e.target.value))
                }
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">
                  Pomodoro Alerts
                </p>
                <p className="text-xs text-grey-500">Notify when timer ends</p>
              </div>
              <button
                onClick={handleTogglePomodoroNotifications}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  pomodoroNotificationsEnabled ? "bg-primary" : "bg-grey-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    pomodoroNotificationsEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">
                  Daily Summary
                </p>
                <p className="text-xs text-grey-500">End of day recap</p>
              </div>
              <button
                onClick={handleToggleDailySummary}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  dailySummaryEnabled ? "bg-primary" : "bg-grey-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    dailySummaryEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Summary Time</p>
                <p className="text-xs text-grey-500">When to send summary</p>
              </div>
              <select
                value={dailySummaryHour}
                onChange={(e) =>
                  handleDailySummaryHourChange(Number(e.target.value))
                }
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
              >
                <option value={17}>5:00 PM</option>
                <option value={18}>6:00 PM</option>
                <option value={19}>7:00 PM</option>
                <option value={20}>8:00 PM</option>
                <option value={21}>9:00 PM</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Privacy */}
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">
            Privacy
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">
                  Local Storage Only
                </p>
                <p className="text-xs text-grey-500">
                  Data never leaves device
                </p>
              </div>
              <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">
                Active
              </span>
            </div>

            {/* Excluded Apps — expandable */}
            <div className="border-t border-white/[0.06]">
              <button
                onClick={() => setIsExcludedExpanded(!isExcludedExpanded)}
                className="w-full flex items-center justify-between py-2"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    Excluded Apps
                  </p>
                  <p className="text-xs text-grey-500">Apps not tracked</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-grey-400">
                    {excludedApps.length} app
                    {excludedApps.length !== 1 ? "s" : ""}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-grey-500 transition-transform ${isExcludedExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </button>

              {isExcludedExpanded && (
                <div className="pb-2 space-y-1">
                  {excludedApps.length === 0 && !isAddingExcluded && (
                    <p className="text-xs text-grey-600 py-1">
                      No excluded apps yet
                    </p>
                  )}

                  {excludedApps.map((app) => (
                    <div
                      key={app.id}
                      className="group/exc flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-white/[0.03]"
                    >
                      <span className="text-xs text-grey-300">
                        {app.app_name}
                      </span>
                      <button
                        onClick={() => handleRemoveExcludedApp(app.id)}
                        className="opacity-0 group-hover/exc:opacity-100 p-0.5 rounded hover:bg-white/5 transition-all"
                        title="Remove"
                      >
                        <svg
                          className="w-3 h-3 text-grey-600 hover:text-error"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {isAddingExcluded ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newExcludedName}
                        onChange={(e) => setNewExcludedName(e.target.value)}
                        placeholder="App name (e.g. Spotify)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white placeholder:text-grey-600 outline-none focus:border-white/20"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddExcludedApp();
                          if (e.key === "Escape") {
                            setIsAddingExcluded(false);
                            setNewExcludedName("");
                          }
                        }}
                      />
                      <button
                        onClick={handleAddExcludedApp}
                        disabled={!newExcludedName.trim()}
                        className="px-2 py-1 text-xs rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingExcluded(false);
                          setNewExcludedName("");
                        }}
                        className="px-2 py-1 text-xs text-grey-500 hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingExcluded(true)}
                      className="flex items-center gap-1 text-[11px] text-grey-500 hover:text-grey-300 transition-all pt-1"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      Add app
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Categories - LIVE */}
        <Card className="lg:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-wider text-grey-500">
              Categories
            </p>
            {!isAdding && (
              <button
                onClick={() => {
                  setIsAdding(true);
                  setEditingId(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Add Category
              </button>
            )}
          </div>

          {isAdding && (
            <div className="mb-3 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <CategoryForm
                onSave={handleCreate}
                onCancel={() => setIsAdding(false)}
              />
            </div>
          )}

          <div className="space-y-0.5">
            {categories.map((cat) => {
              const isExpanded = expandedId === cat.id;
              const isEditing = editingId === cat.id;
              const isDeleting = deletingId === cat.id;
              const rules = rulesMap[cat.id] || [];

              return (
                <div
                  key={cat.id}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  {isEditing ? (
                    <div className="px-3 py-2 bg-white/[0.03] rounded-lg">
                      <CategoryForm
                        initial={{ name: cat.name, color: cat.color }}
                        onSave={(data) => handleUpdate(cat.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div className="group">
                      <div className="flex items-center justify-between py-3">
                        <button
                          onClick={() => toggleExpand(cat.id)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <svg
                            className={`w-3 h-3 text-grey-600 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-sm text-white truncate">
                            {cat.name.replace(/_/g, " ")}
                          </span>
                          {cat.productivityType === "productive" && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-success/10 text-success rounded-full">
                              productive
                            </span>
                          )}
                          {cat.productivityType === "distraction" && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-error/10 text-error rounded-full">
                              distraction
                            </span>
                          )}
                          {cat.isPassive && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-info/10 text-info rounded-full">
                              passive
                            </span>
                          )}
                          {rules.length > 0 && (
                            <span className="text-[10px] text-grey-600">
                              {rules.length} rules
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingId(cat.id);
                              setIsAdding(false);
                            }}
                            className="p-1.5 rounded hover:bg-white/5 transition-all"
                            title="Edit"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-grey-500 hover:text-grey-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                              />
                            </svg>
                          </button>
                          {!cat.isDefault && (
                            <button
                              onClick={() => setDeletingId(cat.id)}
                              className="p-1.5 rounded hover:bg-white/5 transition-all"
                              title="Delete"
                            >
                              <svg
                                className="w-3.5 h-3.5 text-grey-500 hover:text-error"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Delete confirmation */}
                      {isDeleting && (
                        <div className="px-3 py-2.5 mb-2 bg-error/5 border border-error/20 rounded-lg">
                          <p className="text-xs text-grey-300 mb-2">
                            Delete{" "}
                            <strong className="text-white">
                              {cat.name.replace(/_/g, " ")}
                            </strong>
                            ? All activities in this category will become
                            uncategorized.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-3 py-1 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(cat.id)}
                              className="px-3 py-1 text-xs rounded-md bg-error text-white hover:bg-error/80 transition-all"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Expanded rules section */}
                      {isExpanded && (
                        <div className="pb-3 pl-9">
                          {/* Category settings */}
                          <div className="space-y-2 mb-3 pb-3 border-b border-white/[0.04]">
                            {/* Productivity type */}
                            <div className="flex items-center justify-between py-1.5">
                              <div>
                                <p className="text-xs text-grey-300">
                                  Productivity type
                                </p>
                                <p className="text-[10px] text-grey-600">
                                  Used for focus score and reports
                                </p>
                              </div>
                              <div className="flex rounded-lg overflow-hidden border border-white/10">
                                {(
                                  [
                                    "productive",
                                    "neutral",
                                    "distraction",
                                  ] as const
                                ).map((type) => (
                                  <button
                                    key={type}
                                    onClick={() =>
                                      handleProductivityChange(cat.id, type)
                                    }
                                    className={`px-2.5 py-1 text-[10px] capitalize transition-all ${
                                      cat.productivityType === type
                                        ? type === "productive"
                                          ? "bg-success/20 text-success"
                                          : type === "distraction"
                                            ? "bg-error/20 text-error"
                                            : "bg-white/10 text-white"
                                        : "text-grey-600 hover:text-grey-400"
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Passive content toggle */}
                            <div className="flex items-center justify-between py-1.5">
                              <div>
                                <p className="text-xs text-grey-300">
                                  Passive content
                                </p>
                                <p className="text-[10px] text-grey-600">
                                  Skip idle detection (video, calls, music)
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  handleTogglePassive(cat.id, cat.isPassive)
                                }
                                className={`relative w-9 h-5 rounded-full transition-colors ${
                                  cat.isPassive ? "bg-info" : "bg-grey-700"
                                }`}
                              >
                                <div
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                    cat.isPassive ? "left-[18px]" : "left-0.5"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {rules.length === 0 ? (
                            <p className="text-xs text-grey-600 mb-2">
                              No rules yet
                            </p>
                          ) : (
                            <div className="space-y-1 mb-2">
                              {rules.map((rule) => (
                                <div
                                  key={rule.id}
                                  className="group/rule flex items-center gap-2 py-1"
                                >
                                  <span className="px-1.5 py-0.5 text-[10px] bg-white/5 text-grey-500 rounded font-mono">
                                    {rule.type}
                                  </span>
                                  <span className="text-xs text-grey-300 truncate flex-1">
                                    {rule.pattern}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleRemoveRule(cat.id, rule.id)
                                    }
                                    className="opacity-0 group-hover/rule:opacity-100 p-0.5 rounded hover:bg-white/5 transition-all"
                                    title="Remove rule"
                                  >
                                    <svg
                                      className="w-3 h-3 text-grey-600 hover:text-error"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {addingRuleForId === cat.id ? (
                            <AddRuleForm
                              onAdd={(type, pattern) =>
                                handleAddRule(cat.id, type, pattern)
                              }
                              onCancel={() => setAddingRuleForId(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setAddingRuleForId(cat.id)}
                              className="flex items-center gap-1 text-[11px] text-grey-500 hover:text-grey-300 transition-all"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 4.5v15m7.5-7.5h-15"
                                />
                              </svg>
                              Add rule
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {categories.length === 0 && !isAdding && (
            <p className="text-xs text-grey-600 text-center py-4">
              No categories found
            </p>
          )}
        </Card>

        {/* Projects */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-wider text-grey-500">
              Projects
            </p>
            {!isAddingProject && (
              <button
                onClick={() => {
                  setIsAddingProject(true);
                  setEditingProjectId(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Add Project
              </button>
            )}
          </div>

          {isAddingProject && (
            <div className="mb-3 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <CategoryForm
                onSave={handleCreateProject}
                onCancel={() => setIsAddingProject(false)}
              />
            </div>
          )}

          <div className="space-y-0.5">
            {projectList.map((proj) => {
              const isEditing = editingProjectId === proj.id;
              const isDeleting = deletingProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  {isEditing ? (
                    <div className="px-3 py-2 bg-white/[0.03] rounded-lg">
                      <CategoryForm
                        initial={{ name: proj.name, color: proj.color }}
                        onSave={(data) => handleUpdateProject(proj.id, data)}
                        onCancel={() => setEditingProjectId(null)}
                      />
                    </div>
                  ) : (
                    <div className="group">
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span className="text-sm text-white truncate">
                            {proj.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingProjectId(proj.id);
                              setIsAddingProject(false);
                            }}
                            className="p-1.5 rounded hover:bg-white/5 transition-all"
                            title="Edit"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-grey-500 hover:text-grey-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingProjectId(proj.id)}
                            className="p-1.5 rounded hover:bg-white/5 transition-all"
                            title="Delete"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-grey-500 hover:text-error"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {isDeleting && (
                        <div className="px-3 py-2.5 mb-2 bg-error/5 border border-error/20 rounded-lg">
                          <p className="text-xs text-grey-300 mb-2">
                            Delete{" "}
                            <strong className="text-white">{proj.name}</strong>?
                            Sessions will be unassigned.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDeletingProjectId(null)}
                              className="px-3 py-1 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteProject(proj.id)}
                              className="px-3 py-1 text-xs rounded-md bg-error text-white hover:bg-error/80 transition-all"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {projectList.length === 0 && !isAddingProject && (
            <p className="text-xs text-grey-600 text-center py-4">
              No projects yet
            </p>
          )}
        </Card>

        {/* Data Management */}
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">
            Data
          </p>
          <div className="space-y-2">
            {/* Clear All Data — functional with confirmation */}
            {!isConfirmingClear ? (
              <button
                onClick={() => setIsConfirmingClear(true)}
                className="w-full flex items-center justify-between py-3 text-left rounded-lg px-2 -mx-2 hover:bg-white/[0.03] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-error">Clear All Data</p>
                  <p className="text-xs text-grey-500">Delete all tracked activities</p>
                </div>
                <svg
                  className="w-5 h-5 text-grey-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </button>
            ) : (
              <div className="px-3 py-3 bg-error/5 border border-error/20 rounded-lg">
                <p className="text-xs text-grey-300 mb-3">
                  This will permanently delete all your tracked activities, sessions, and pomodoro records. Your categories, projects, and settings will be preserved.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsConfirmingClear(false)}
                    disabled={isClearing}
                    className="px-3 py-1.5 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllData}
                    disabled={isClearing}
                    className="px-3 py-1.5 text-xs rounded-md bg-error text-white hover:bg-error/80 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isClearing ? (
                      <>
                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      "Delete All Data"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* About */}
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">
            About
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-grey-500">Version</span>
              <span className="text-white">{appVersion}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-white/[0.06]">
              <span className="text-grey-500">Platform</span>
              <span className="text-white">{navigator.platform}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-white/[0.06]">
              <span className="text-grey-500">Feedback</span>
              <button
                onClick={() =>
                  window.electronAPI.openExternal(
                    "https://github.com/Yosef-Adel/activity-tracker/issues/new",
                  )
                }
                className="text-primary hover:text-primary-light text-sm transition-colors"
              >
                Send Feedback →
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
