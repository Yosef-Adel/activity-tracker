import { useEffect, useState } from "react";
import { Card } from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchSessions, setDateRangeToday, setDateRangeWeek, setCurrentActivity } from "../store/slices";
import { formatDuration, formatTime } from "../utils/time";
import type { SessionWithActivities } from "../types/electron";

const CATEGORY_COLORS: Record<string, string> = {
  development: "#8b5cf6",
  communication: "#22c55e",
  social: "#eab308",
  entertainment: "#ef4444",
  productivity: "#a855f7",
  research: "#0ea5e9",
  email: "#ec4899",
  design: "#f97316",
  uncategorized: "#71717a",
};

export function ActivitiesPage() {
  const dispatch = useAppDispatch();
  const { sessions, dateRange } = useAppSelector((state) => state.tracking);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"today" | "week">("today");

  const toggleSession = (sessionId: number) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (viewMode === "today") {
      dispatch(setDateRangeToday());
    } else {
      dispatch(setDateRangeWeek());
    }
  }, [dispatch, viewMode]);

  useEffect(() => {
    dispatch(fetchSessions({ start: dateRange.start, end: dateRange.end }));

    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchSessions({ start: dateRange.start, end: Date.now() }));
    });

    return () => unsubscribe();
  }, [dispatch, dateRange]);

  // Group sessions by date
  const groupedSessions = sessions.reduce(
    (groups, session) => {
      const date = new Date(session.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(session);
      return groups;
    },
    {} as Record<string, SessionWithActivities[]>,
  );

  // Calculate daily totals
  const dailyTotals = Object.entries(groupedSessions).reduce(
    (totals, [date, daySessions]) => {
      totals[date] = daySessions.reduce((sum, s) => sum + s.total_duration, 0);
      return totals;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Activities</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("today")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              viewMode === "today"
                ? "bg-white/10 text-white"
                : "text-grey-400 hover:text-white"
            }`}
          >
            Today
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

      {sessions.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-grey-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-grey-400 mb-1">No activities recorded yet</p>
            <p className="text-grey-600 text-sm">Start using your computer and activities will appear here</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSessions).map(([date, daySessions]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-grey-400">{date}</h3>
                <span className="text-xs text-grey-500">{formatDuration(dailyTotals[date])}</span>
              </div>
              <div className="space-y-2">
                {daySessions.map((session) => {
                  const isExpanded = expandedSessions.has(session.id);
                  const hasMultipleActivities = session.activities.length > 1;
                  const category = session.category || "uncategorized";

                  return (
                    <Card key={session.id} noPadding>
                      <div
                        className={`flex items-center gap-4 p-4 ${hasMultipleActivities ? "cursor-pointer hover:bg-white/[0.02]" : ""} transition-colors`}
                        onClick={() => hasMultipleActivities && toggleSession(session.id)}
                      >
                        <div
                          className="w-1 self-stretch rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[category] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm">{session.app_name}</span>
                            <span
                              className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded"
                              style={{
                                backgroundColor: CATEGORY_COLORS[category] + "20",
                                color: CATEGORY_COLORS[category],
                              }}
                            >
                              {category}
                            </span>
                            {hasMultipleActivities && (
                              <span className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-grey-400">
                                {session.activity_count} items
                              </span>
                            )}
                          </div>
                          {!isExpanded && session.activities.length > 0 && (
                            <p className="text-xs text-grey-500 truncate">
                              {session.activities[0].window_title}
                              {hasMultipleActivities && (
                                <span className="text-grey-600 ml-2">+{session.activity_count - 1} more</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-grey-500">
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </p>
                          <p className="text-sm font-medium text-white">
                            {formatDuration(session.total_duration)}
                          </p>
                        </div>
                        {hasMultipleActivities && (
                          <svg
                            className={`w-4 h-4 text-grey-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>

                      <div
                        className="grid transition-all duration-300 ease-out"
                        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                      >
                        <div className="overflow-hidden">
                          <div className="px-4 pb-4 ml-5 border-l border-white/[0.06] space-y-1">
                            {session.activities.map((activity, index) => (
                              <div
                                key={activity.id}
                                className="flex items-center gap-4 py-2 pl-4 rounded hover:bg-white/[0.02] transition-all duration-300"
                                style={{
                                  opacity: isExpanded ? 1 : 0,
                                  transform: isExpanded ? "translateY(0)" : "translateY(-10px)",
                                  transitionDelay: isExpanded ? `${index * 30}ms` : "0ms",
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-grey-300 truncate">
                                    {activity.window_title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {activity.url && (
                                      <p className="text-xs text-info truncate max-w-xs">{activity.domain || activity.url}</p>
                                    )}
                                    {activity.project_name && (
                                      <p className="text-xs text-primary">
                                        {activity.project_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right text-xs text-grey-500">
                                  <p>{formatTime(activity.start_time)}</p>
                                  <p className="text-grey-400">{formatDuration(activity.duration)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
