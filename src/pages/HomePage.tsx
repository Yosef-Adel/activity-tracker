import { useEffect, useState } from "react";
import { Card } from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchTrackerStatus,
  fetchDashboardData,
  setCurrentActivity,
  setDateRangeToday,
  setDateRangeWeek,
} from "../store/slices";
import { formatDuration, getPercentage } from "../utils/time";

// Hook for live elapsed time
function useElapsedTime(startTime: number | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    // Initial calculation
    setElapsed(Date.now() - startTime);

    // Update every second
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return elapsed;
}

const CATEGORY_COLORS: Record<string, string> = {
  development: "#6366F1",
  communication: "#22C55E",
  social: "#EAB308",
  entertainment: "#EF4444",
  productivity: "#A855F7",
  research: "#0EA5E9",
  email: "#EC4899",
  design: "#F97316",
  uncategorized: "#64748B",
};

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
    isLoading,
  } = useAppSelector((state) => state.tracking);

  // Live timer for current activity
  const elapsedTime = useElapsedTime(status?.trackingSince ?? null);

  useEffect(() => {
    dispatch(fetchTrackerStatus());
    dispatch(setDateRangeToday());

    // Listen for activity changes and refresh data
    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      // Refresh tracker status to get new trackingSince for timer
      dispatch(fetchTrackerStatus());
      // Refresh dashboard data when activity changes
      dispatch(fetchDashboardData({ start: dateRange.start, end: Date.now() }));
    });

    // Also set up periodic refresh every 10 seconds for live updates
    const refreshInterval = setInterval(() => {
      dispatch(fetchTrackerStatus()); // Check for idle state changes
      dispatch(fetchDashboardData({ start: dateRange.start, end: Date.now() }));
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [dispatch, dateRange.start]);

  useEffect(() => {
    dispatch(fetchDashboardData({ start: dateRange.start, end: dateRange.end }));
  }, [dispatch, dateRange]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch(setDateRangeToday())}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary-light transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => dispatch(setDateRangeWeek())}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary-light transition-colors"
          >
            Week
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {status && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            status.isRunning ? "bg-success/20" : "bg-warning/20"
          }`}
        >
          <p className={status.isRunning ? "text-success" : "text-warning"}>
            {status.platformMessage}
          </p>
        </div>
      )}

      {/* Idle State */}
      {status?.isIdle && (
        <Card className="mb-6 !bg-grey-800/50 border border-grey-700">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-grey-500" />
            <div className="flex-1">
              <p className="text-sm text-grey-500">Idle</p>
              <p className="font-medium text-grey-400">No activity detected</p>
              <p className="text-sm text-grey-500">Tracking paused due to inactivity</p>
            </div>
          </div>
        </Card>
      )}

      {/* Current Activity */}
      {currentActivity && !status?.isIdle && (
        <Card variant="blue" className="mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: CATEGORY_COLORS[currentActivity.category] }}
            />
            <div className="flex-1">
              <p className="text-sm text-grey-400">Currently tracking</p>
              <p className="font-medium">{currentActivity.appName}</p>
              <p className="text-sm text-grey-300 truncate">{currentActivity.title}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-bold mb-1">
                {formatDuration(elapsedTime)}
              </p>
              <span
                className="px-2 py-1 text-xs rounded-full"
                style={{
                  backgroundColor: CATEGORY_COLORS[currentActivity.category] + "30",
                  color: CATEGORY_COLORS[currentActivity.category],
                }}
              >
                {currentActivity.category}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-sm text-grey-400 mb-1">Total Time</p>
          <p className="text-2xl font-bold">{formatDuration(totalTime)}</p>
        </Card>
        <Card>
          <p className="text-sm text-grey-400 mb-1">Apps Used</p>
          <p className="text-2xl font-bold">{appUsage.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-grey-400 mb-1">Projects</p>
          <p className="text-2xl font-bold">{projectTime.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-grey-400 mb-1">Sessions</p>
          <p className="text-2xl font-bold">
            {appUsage.reduce((sum, app) => sum + app.session_count, 0)}
          </p>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-grey-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Categories</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-grey-400">No data yet</p>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{cat.category}</span>
                      <span className="text-grey-400">
                        {formatDuration(cat.total_duration)}
                      </span>
                    </div>
                    <div className="h-2 bg-grey-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${getPercentage(cat.total_duration, totalTime)}%`,
                          backgroundColor: CATEGORY_COLORS[cat.category],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top Apps */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Top Apps</h3>
            {appUsage.length === 0 ? (
              <p className="text-grey-400">No data yet</p>
            ) : (
              <div className="space-y-3">
                {appUsage.slice(0, 5).map((app) => (
                  <div
                    key={app.app_name}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate flex-1">{app.app_name}</span>
                    <span className="text-grey-400 ml-2">
                      {formatDuration(app.total_duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Projects */}
          <Card variant="green">
            <h3 className="text-lg font-semibold mb-4">Projects</h3>
            {projectTime.length === 0 ? (
              <p className="text-grey-300">No projects detected</p>
            ) : (
              <div className="space-y-3">
                {projectTime.slice(0, 5).map((project) => (
                  <div
                    key={project.project_name}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate flex-1">{project.project_name}</span>
                    <span className="text-grey-300 ml-2">
                      {formatDuration(project.total_duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Stats */}
          <Card variant="brown">
            <h3 className="text-lg font-semibold mb-4">Productivity Score</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-grey-300">Start tracking to see your score</p>
            ) : (
              <div>
                {(() => {
                  const productiveCategories = [
                    "development",
                    "productivity",
                    "research",
                    "design",
                  ];
                  const productiveTime = categoryBreakdown
                    .filter((c) => productiveCategories.includes(c.category))
                    .reduce((sum, c) => sum + c.total_duration, 0);
                  const score = getPercentage(productiveTime, totalTime);

                  return (
                    <>
                      <p className="text-4xl font-bold mb-2">{score}%</p>
                      <p className="text-grey-300 text-sm">
                        {formatDuration(productiveTime)} productive time
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
