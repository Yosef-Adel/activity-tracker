import { useEffect, useState, useMemo } from "react";
import {
  Card,
  SkeletonTimeline,
  SkeletonActivityFeed,
  SkeletonStatCard,
  SkeletonListCard,
} from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchTrackerStatus,
  fetchDashboardData,
  fetchActivities,
  fetchSessions,
  setCurrentActivity,
  setDateRangeToday,
  setDateRangeWeek,
} from "../store/slices";
import { formatDuration, getPercentage } from "../utils/time";
import type { HourlyPattern, CategoryInfo } from "../types/electron";

// Hook for live elapsed time
function useElapsedTime(startTime: number | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

// Compact circular progress for goals
function MiniGoalCircle({ percent, color }: { percent: number; color: string }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width="40" height="40" className="transform -rotate-90">
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-white/10"
      />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HomePage() {
  const dispatch = useAppDispatch();
  const {
    status,
    currentActivity,
    appUsage,
    categoryBreakdown,
    totalTime,
    dateRange,
    sessions,
  } = useAppSelector((state) => state.tracking);

  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern[]>([]);
  const [categoryList, setCategoryList] = useState<CategoryInfo[]>([]);
  const [goals, setGoals] = useState<Array<{ categoryName: string; targetMs: number }>>([]);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Build a lookup set of productive category names from user settings
  const productiveCategoryNames = useMemo(() => {
    const set = new Set<string>();
    categoryList.forEach((c) => { if (c.productivityType === "productive") set.add(c.name); });
    return set;
  }, [categoryList]);

  const elapsedTime = useElapsedTime(status?.trackingSince ?? null);

  // Calculate focus score
  const focusScore = useMemo(() => {
    const productiveTime = categoryBreakdown
      .filter((c) => productiveCategoryNames.has(c.category_name))
      .reduce((sum, c) => sum + c.total_duration, 0);
    return totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;
  }, [categoryBreakdown, totalTime, productiveCategoryNames]);

  // Goals with progress
  const goalsWithProgress = useMemo(() => {
    return goals.map((goal) => {
      const cat = categoryBreakdown.find((c) => c.category_name === goal.categoryName);
      const current = cat?.total_duration ?? 0;
      const targetMs = goal.targetMs;
      const percent = targetMs > 0 ? Math.min(100, Math.round((current / targetMs) * 100)) : 0;
      const categoryInfo = categoryList.find((c) => c.name === goal.categoryName);
      return {
        categoryName: goal.categoryName,
        current,
        targetMs,
        percent,
        color: categoryInfo?.color ?? cat?.category_color ?? "#6366f1",
      };
    });
  }, [goals, categoryBreakdown, categoryList]);

  // Timeline data (hourly blocks)
  const timelineData = useMemo(() => {
    const hours = [];
    let maxMinutes = 0;
    const hourTotals: { [key: number]: { minutes: number; color: string | null } } = {};

    for (let i = 6; i <= 21; i++) {
      const hourStr = i.toString().padStart(2, "0");
      const hourData = hourlyPattern.filter((h) => h.hour === hourStr);
      const totalMinutes = hourData.reduce((sum, h) => sum + h.total_duration / 60000, 0);
      const dominant = hourData.length > 0
        ? hourData.reduce((max, h) => (h.total_duration > max.total_duration ? h : max), hourData[0])
        : null;

      hourTotals[i] = { minutes: totalMinutes, color: dominant?.category_color ?? null };
      if (totalMinutes > maxMinutes) maxMinutes = totalMinutes;
    }

    const scaleMax = Math.max(maxMinutes, 30);

    for (let i = 6; i <= 21; i++) {
      const { minutes, color } = hourTotals[i];
      hours.push({
        hour: i,
        label: `${i}:00`,
        minutes,
        color,
        height: minutes > 0 ? Math.max(8, (minutes / scaleMax) * 100) : 0,
      });
    }
    return hours;
  }, [hourlyPattern]);

  const handleViewModeChange = (mode: "day" | "week") => {
    if (mode === viewMode) return;
    setIsTransitioning(true);
    setViewMode(mode);
    setTimeout(() => setIsTransitioning(false), 150);
  };

  useEffect(() => {
    dispatch(fetchTrackerStatus());
    if (viewMode === "day") {
      dispatch(setDateRangeToday());
    } else {
      dispatch(setDateRangeWeek());
    }
  }, [dispatch, viewMode]);

  useEffect(() => {
    const loadData = async () => {
      const goalsStr = await window.electronAPI.getSetting("daily_goals");
      if (goalsStr) {
        try { setGoals(JSON.parse(goalsStr)); } catch { /* ignore */ }
      }
      await Promise.all([
        dispatch(fetchDashboardData({ start: dateRange.start, end: dateRange.end })),
        dispatch(fetchActivities({ start: dateRange.start, end: dateRange.end })),
        dispatch(fetchSessions({ start: dateRange.start, end: dateRange.end })),
        window.electronAPI.getHourlyPattern(dateRange.start, dateRange.end).then(setHourlyPattern),
        window.electronAPI.getCategories().then(setCategoryList),
      ]);
      setIsInitialLoad(false);
    };
    loadData();

    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchTrackerStatus());
      dispatch(fetchDashboardData({ start: dateRange.start, end: Date.now() }));
      dispatch(fetchActivities({ start: dateRange.start, end: Date.now() }));
      dispatch(fetchSessions({ start: dateRange.start, end: Date.now() }));
      window.electronAPI.getHourlyPattern(dateRange.start, Date.now()).then(setHourlyPattern);
    });

    return () => unsubscribe();
  }, [dispatch, dateRange]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-white">{today}</h1>
          {/* Current Activity Indicator */}
          {currentActivity && !status?.isIdle && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: currentActivity.categoryColor }}
              />
              <span className="text-sm text-white">{currentActivity.appName}</span>
              <span className="text-xs text-grey-500">•</span>
              <span className="text-sm font-mono text-grey-400">{formatDuration(elapsedTime)}</span>
            </div>
          )}
          {status?.isIdle && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-sm text-warning">Idle</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewModeChange("day")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              viewMode === "day"
                ? "bg-white/10 text-white"
                : "text-grey-400 hover:text-white"
            }`}
          >
            Day
          </button>
          <button
            onClick={() => handleViewModeChange("week")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              viewMode === "week"
                ? "bg-white/10 text-white"
                : "text-grey-400 hover:text-white"
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {isInitialLoad ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-9 space-y-4">
            <SkeletonTimeline />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SkeletonListCard />
              <SkeletonListCard />
            </div>
            <SkeletonActivityFeed />
          </div>
          <div className="xl:col-span-3 space-y-4">
            <SkeletonStatCard />
            <SkeletonListCard />
          </div>
        </div>
      ) : (
      <div className={`grid grid-cols-1 xl:grid-cols-12 gap-4 transition-opacity duration-150 ${isTransitioning ? "opacity-50" : "opacity-100"}`}>
        {/* Main Content */}
        <div className="xl:col-span-9 space-y-4">
          {/* Timeline Card - Larger */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Timeline</p>
            <div className="flex items-end gap-1 h-28">
              {timelineData.map((hour) => (
                <div key={hour.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className="w-full rounded-t transition-all duration-300 hover:opacity-80"
                    style={{
                      height: hour.minutes > 0 ? `${hour.height}%` : "4px",
                      backgroundColor: hour.color || "#27272a",
                      minHeight: hour.minutes > 0 ? "8px" : "4px",
                    }}
                  />
                  {/* Tooltip */}
                  {hour.minutes > 0 && (
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                      <div className="bg-grey-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        {Math.round(hour.minutes)}m
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 text-[10px] text-grey-500">
              {timelineData.filter((_, i) => i % 2 === 0).map((hour) => (
                <span key={hour.hour}>{hour.hour}:00</span>
              ))}
            </div>
          </Card>

          {/* Top Apps + Categories Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Apps */}
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Top Apps</p>
              <div className="space-y-2.5">
                {appUsage.slice(0, 5).map((app) => {
                  const percent = getPercentage(app.total_duration, totalTime);
                  return (
                    <div key={app.app_name} className="flex items-center gap-3">
                      <span className="text-sm text-white flex-1 truncate">{app.app_name}</span>
                      <div className="w-20 h-1.5 bg-grey-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-grey-500 w-12 text-right">{formatDuration(app.total_duration)}</span>
                    </div>
                  );
                })}
                {appUsage.length === 0 && (
                  <p className="text-grey-500 text-sm text-center py-4">No apps tracked yet</p>
                )}
              </div>
            </Card>

            {/* Categories */}
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Categories</p>
              <div className="space-y-2.5">
                {categoryBreakdown.slice(0, 5).map((cat) => {
                  const percent = getPercentage(cat.total_duration, totalTime);
                  return (
                    <div key={cat.category_id} className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.category_color }}
                      />
                      <span className="capitalize text-sm text-white flex-1 truncate">{cat.category_name}</span>
                      <span className="text-xs text-grey-600 w-8">{percent}%</span>
                      <span className="text-xs text-grey-500 w-12 text-right">{formatDuration(cat.total_duration)}</span>
                    </div>
                  );
                })}
                {categoryBreakdown.length === 0 && (
                  <p className="text-grey-500 text-sm text-center py-4">No activity yet</p>
                )}
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Recent Activity</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {sessions.slice(0, 12).map((session) => (
                <div key={session.id} className="flex items-center gap-3 text-sm py-1">
                  <span className="text-grey-500 text-xs font-mono w-12">
                    {new Date(session.start_time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span
                    className="w-1 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: session.category_color || "#71717a" }}
                  />
                  <span className="text-white truncate flex-1">{session.app_name}</span>
                  <span className="text-grey-600 text-xs capitalize">{session.category_name}</span>
                  <span className="text-grey-500 text-xs w-14 text-right">{formatDuration(session.total_duration)}</span>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-grey-500 text-sm text-center py-8">No activity recorded today</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Compact */}
        <div className="xl:col-span-3 space-y-4">
          {/* Total Time + Focus Score */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] text-grey-500 mb-1">Total time</p>
                <p className="text-3xl font-semibold text-white">{formatDuration(totalTime)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-grey-500 mb-1">Focus</p>
                <p className="text-2xl font-semibold text-primary">{focusScore}%</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-grey-500">
                {status?.isPaused ? "Paused" : status?.isRunning ? "Tracking" : "Stopped"}
              </span>
              {status?.isRunning && (
                <button
                  onClick={async () => {
                    if (status?.isPaused) {
                      await window.electronAPI.resumeTracking();
                    } else {
                      await window.electronAPI.pauseTracking();
                    }
                    dispatch(fetchTrackerStatus());
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    status?.isPaused
                      ? "bg-primary/20 text-primary hover:bg-primary/30"
                      : "bg-white/5 text-grey-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {status?.isPaused ? "Resume" : "Pause"}
                </button>
              )}
            </div>
          </Card>

          {/* Daily Goals - Compact */}
          {goalsWithProgress.length > 0 && (
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Daily Goals</p>
              <div className="space-y-3">
                {goalsWithProgress.map((goal) => (
                  <div key={goal.categoryName} className="flex items-center gap-3">
                    <MiniGoalCircle percent={goal.percent} color={goal.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white capitalize truncate">{goal.categoryName.replace(/_/g, " ")}</p>
                      <p className="text-[11px] text-grey-500">
                        {formatDuration(goal.current)} / {formatDuration(goal.targetMs)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-white">{goal.percent}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Productivity Breakdown */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Productivity</p>
            <div className="space-y-3">
              {/* Productive */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm text-white flex-1">Productive</span>
                <span className="text-xs text-grey-500">
                  {formatDuration(
                    categoryBreakdown
                      .filter((c) => c.productivity_type === "productive")
                      .reduce((sum, c) => sum + c.total_duration, 0)
                  )}
                </span>
              </div>
              {/* Neutral */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-grey-500" />
                <span className="text-sm text-white flex-1">Neutral</span>
                <span className="text-xs text-grey-500">
                  {formatDuration(
                    categoryBreakdown
                      .filter((c) => c.productivity_type === "neutral")
                      .reduce((sum, c) => sum + c.total_duration, 0)
                  )}
                </span>
              </div>
              {/* Distraction */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-error" />
                <span className="text-sm text-white flex-1">Distraction</span>
                <span className="text-xs text-grey-500">
                  {formatDuration(
                    categoryBreakdown
                      .filter((c) => c.productivity_type === "distraction")
                      .reduce((sum, c) => sum + c.total_duration, 0)
                  )}
                </span>
              </div>
            </div>
            {/* Mini bar */}
            <div className="flex h-2 rounded-full overflow-hidden mt-4 bg-grey-800">
              {(() => {
                const productive = categoryBreakdown
                  .filter((c) => c.productivity_type === "productive")
                  .reduce((sum, c) => sum + c.total_duration, 0);
                const neutral = categoryBreakdown
                  .filter((c) => c.productivity_type === "neutral")
                  .reduce((sum, c) => sum + c.total_duration, 0);
                const distraction = categoryBreakdown
                  .filter((c) => c.productivity_type === "distraction")
                  .reduce((sum, c) => sum + c.total_duration, 0);
                const total = productive + neutral + distraction;
                if (total === 0) return null;
                return (
                  <>
                    <div className="bg-success" style={{ width: `${(productive / total) * 100}%` }} />
                    <div className="bg-grey-500" style={{ width: `${(neutral / total) * 100}%` }} />
                    <div className="bg-error" style={{ width: `${(distraction / total) * 100}%` }} />
                  </>
                );
              })()}
            </div>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
