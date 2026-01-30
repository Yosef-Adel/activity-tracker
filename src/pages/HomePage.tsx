import { useEffect, useState, useMemo } from "react";
import { Card, ScoreCircle } from "../components";
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
import type { HourlyPattern, DomainUsage } from "../types/electron";

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

const PRODUCTIVE_CATEGORIES = ["development", "productivity", "research", "design"];

export function HomePage() {
  const dispatch = useAppDispatch();
  const {
    status,
    currentActivity,
    appUsage,
    categoryBreakdown,
    projectTime,
    totalTime,
    dateRange,
    sessions,
  } = useAppSelector((state) => state.tracking);

  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern[]>([]);
  const [domainUsage, setDomainUsage] = useState<DomainUsage[]>([]);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  const elapsedTime = useElapsedTime(status?.trackingSince ?? null);

  // Calculate scores
  const scores = useMemo(() => {
    const productiveTime = categoryBreakdown
      .filter((c) => PRODUCTIVE_CATEGORIES.includes(c.category_name))
      .reduce((sum, c) => sum + c.total_duration, 0);

    const meetingTime = categoryBreakdown
      .filter((c) => c.category_name === "communication")
      .reduce((sum, c) => sum + c.total_duration, 0);

    const focusScore = totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;
    const meetingPercent = totalTime > 0 ? Math.round((meetingTime / totalTime) * 100) : 0;

    return {
      focus: focusScore,
      focusTime: productiveTime,
      meetings: meetingPercent,
      meetingTime: meetingTime,
    };
  }, [categoryBreakdown, totalTime]);

  // Timeline data (hourly blocks)
  const timelineData = useMemo(() => {
    const hours = [];
    // Find max minutes for scaling
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

    // Scale based on max (or use 60 minutes as baseline if no data)
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

  useEffect(() => {
    dispatch(fetchTrackerStatus());
    if (viewMode === "day") {
      dispatch(setDateRangeToday());
    } else {
      dispatch(setDateRangeWeek());
    }
  }, [dispatch, viewMode]);

  useEffect(() => {
    dispatch(fetchDashboardData({ start: dateRange.start, end: dateRange.end }));
    dispatch(fetchActivities({ start: dateRange.start, end: dateRange.end }));
    dispatch(fetchSessions({ start: dateRange.start, end: dateRange.end }));
    window.electronAPI.getHourlyPattern(dateRange.start, dateRange.end).then(setHourlyPattern);
    window.electronAPI.getDomainUsage(dateRange.start, dateRange.end).then(setDomainUsage);

    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchTrackerStatus());
      dispatch(fetchDashboardData({ start: dateRange.start, end: Date.now() }));
      dispatch(fetchActivities({ start: dateRange.start, end: Date.now() }));
      dispatch(fetchSessions({ start: dateRange.start, end: Date.now() }));
      window.electronAPI.getHourlyPattern(dateRange.start, Date.now()).then(setHourlyPattern);
      window.electronAPI.getDomainUsage(dateRange.start, Date.now()).then(setDomainUsage);
    });

    return () => unsubscribe();
  }, [dispatch, dateRange]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const workDayPercent = Math.min(100, Math.round((totalTime / (8 * 60 * 60 * 1000)) * 100));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{today}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("day")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              viewMode === "day"
                ? "bg-white/10 text-white"
                : "text-grey-400 hover:text-white"
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setViewMode("week")}
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Main Content - Left Side */}
        <div className="xl:col-span-8 space-y-4">
          {/* Timeline Card */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Timeline</p>
            <div className="flex items-end gap-1.5 h-20">
              {timelineData.map((hour) => (
                <div key={hour.hour} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: hour.minutes > 0 ? `${hour.height}%` : "4px",
                      backgroundColor: hour.color || "#27272a",
                      minHeight: hour.minutes > 0 ? "8px" : "4px",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 text-[10px] text-grey-500">
              {timelineData.filter((_, i) => i % 2 === 0).map((hour) => (
                <span key={hour.hour}>{hour.hour}:00</span>
              ))}
            </div>
          </Card>

          {/* Current Activity */}
          {currentActivity && !status?.isIdle && (
            <Card className="border-l-2 border-l-primary">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: currentActivity.categoryColor }}
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{currentActivity.appName}</p>
                    <p className="text-xs text-grey-500 truncate max-w-md">{currentActivity.title}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono font-semibold text-white">
                    {formatDuration(elapsedTime)}
                  </p>
                  <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: currentActivity.categoryColor }}
                  >
                    {currentActivity.categoryName}
                  </span>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Activity Feed (grouped by session) */}
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Activity</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sessions.slice(0, 10).map((session) => (
                  <div key={session.id} className="flex items-center gap-3 text-sm">
                    <span className="text-grey-500 text-xs font-mono w-14">
                      {new Date(session.start_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                    <span
                      className="w-1 h-4 rounded-full"
                      style={{ backgroundColor: session.category_color || "#71717a" }}
                    />
                    <span className="text-white truncate flex-1">{session.app_name}</span>
                    {session.activity_count > 1 && (
                      <span className="text-grey-600 text-[10px]">{session.activity_count}</span>
                    )}
                    <span className="text-grey-500 text-xs">{formatDuration(session.total_duration)}</span>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-grey-500 text-sm">No activity yet</p>
                )}
              </div>
            </Card>

            {/* Projects */}
            <Card>
              <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Projects</p>
              <div className="space-y-3">
                {projectTime.slice(0, 6).map((project) => {
                  const percent = getPercentage(project.total_duration, totalTime);
                  return (
                    <div key={project.project_name} className="flex items-center gap-3">
                      <span className="text-xs text-grey-500 w-8">{percent}%</span>
                      <span className="text-sm text-white flex-1 truncate">{project.project_name}</span>
                      <div className="w-20 h-1.5 bg-grey-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-grey-500 w-16 text-right">
                        {formatDuration(project.total_duration)}
                      </span>
                    </div>
                  );
                })}
                {projectTime.length === 0 && (
                  <p className="text-grey-500 text-sm">No projects detected</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          {/* Work Hours */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-3">Work Hours</p>
            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
              <div>
                <p className="text-[11px] text-grey-500 mb-1">Total time</p>
                <p className="text-2xl xl:text-3xl font-semibold text-white">{formatDuration(totalTime)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-grey-500 mb-1">Of work day</p>
                <p className="text-xl xl:text-2xl font-semibold text-white">{workDayPercent}%</p>
                <p className="text-[10px] text-grey-500">of 8hr</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-grey-500">
              <span>
                Tracking: {status?.isPaused ? "Paused" : status?.isRunning ? "On" : "Off"}
              </span>
              <div className="flex items-center gap-2">
                {status?.isIdle && <span className="text-warning">Idle</span>}
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
            </div>
          </Card>

          {/* Scores */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Scores</p>
            <div className="flex flex-wrap gap-4">
              <ScoreCircle
                score={scores.focus}
                label="Focus"
                subLabel={formatDuration(scores.focusTime)}
                color="#8b5cf6"
              />
              <ScoreCircle
                score={scores.meetings}
                label="Meetings"
                subLabel={formatDuration(scores.meetingTime)}
                color="#22c55e"
              />
            </div>
          </Card>

          {/* Time Breakdown */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Time Breakdown</p>
            <div className="space-y-2.5">
              {categoryBreakdown.slice(0, 6).map((cat) => {
                const percent = getPercentage(cat.total_duration, totalTime);
                return (
                  <div key={cat.category_id} className="flex items-center gap-2">
                    <span className="text-xs text-grey-500 w-7 flex-shrink-0">{percent}%</span>
                    <span className="capitalize text-sm text-white flex-1 truncate min-w-0">{cat.category_name}</span>
                    <div className="w-12 h-1.5 bg-grey-800 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: cat.category_color,
                        }}
                      />
                    </div>
                    <span className="text-xs text-grey-500 flex-shrink-0">
                      {formatDuration(cat.total_duration)}
                    </span>
                  </div>
                );
              })}
              {categoryBreakdown.length === 0 && (
                <p className="text-grey-500 text-sm">No data yet</p>
              )}
            </div>
          </Card>

          {/* Websites */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Websites</p>
            <div className="space-y-2">
              {domainUsage.slice(0, 6).map((site, index) => (
                <div key={site.domain} className="flex items-center gap-2">
                  <span className="text-xs text-grey-600 w-4 flex-shrink-0">{index + 1}</span>
                  <span className="text-sm text-white flex-1 truncate min-w-0">{site.domain}</span>
                  <span className="text-xs text-grey-500 flex-shrink-0">{formatDuration(site.total_duration)}</span>
                </div>
              ))}
              {domainUsage.length === 0 && (
                <p className="text-grey-500 text-sm">No websites tracked yet</p>
              )}
            </div>
          </Card>

          {/* Top Apps */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Top Apps</p>
            <div className="space-y-2">
              {appUsage.slice(0, 5).map((app, index) => (
                <div key={app.app_name} className="flex items-center gap-2">
                  <span className="text-xs text-grey-600 w-4 flex-shrink-0">{index + 1}</span>
                  <span className="text-sm text-white flex-1 truncate min-w-0">{app.app_name}</span>
                  <span className="text-xs text-grey-500 flex-shrink-0">{formatDuration(app.total_duration)}</span>
                </div>
              ))}
              {appUsage.length === 0 && (
                <p className="text-grey-500 text-sm">No apps tracked yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
