import { useEffect, useState } from "react";
import { Card } from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchSessions, setDateRangeToday, setDateRangeWeek, setCurrentActivity } from "../store/slices";
import { formatDuration, formatTime } from "../utils/time";
import type { SessionWithActivities } from "../types/electron";

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

export function ActivitiesPage() {
  const dispatch = useAppDispatch();
  const { sessions, dateRange } = useAppSelector((state) => state.tracking);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());

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
    dispatch(fetchSessions({ start: dateRange.start, end: dateRange.end }));

    // Listen for activity changes and refresh
    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchSessions({ start: dateRange.start, end: Date.now() }));
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, dateRange.start]);

  // Group sessions by date
  const groupedSessions = sessions.reduce(
    (groups, session) => {
      const date = new Date(session.start_time).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(session);
      return groups;
    },
    {} as Record<string, SessionWithActivities[]>,
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Activities</h2>
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

      {sessions.length === 0 ? (
        <Card>
          <p className="text-grey-400 text-center py-8">
            No activities recorded yet. Start using your computer and activities will
            appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSessions).map(([date, daySessions]) => (
            <div key={date}>
              <h3 className="text-lg font-medium mb-3 text-grey-300">{date}</h3>
              <div className="space-y-2">
                {daySessions.map((session) => {
                  const isExpanded = expandedSessions.has(session.id);
                  const hasMultipleActivities = session.activities.length > 1;
                  const category = session.category || "uncategorized";

                  return (
                    <Card key={session.id} className="!p-4">
                      <div
                        className={`flex items-start gap-4 ${hasMultipleActivities ? "cursor-pointer" : ""}`}
                        onClick={() => hasMultipleActivities && toggleSession(session.id)}
                      >
                        <div
                          className="w-1 h-full min-h-[60px] rounded-full"
                          style={{
                            backgroundColor: CATEGORY_COLORS[category],
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{session.app_name}</span>
                            <span
                              className="px-2 py-0.5 text-xs rounded-full"
                              style={{
                                backgroundColor:
                                  CATEGORY_COLORS[category] + "30",
                                color: CATEGORY_COLORS[category],
                              }}
                            >
                              {category}
                            </span>
                            {hasMultipleActivities && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-grey-700 text-grey-300">
                                {session.activity_count} files
                              </span>
                            )}
                          </div>
                          {!isExpanded && session.activities.length > 0 && (
                            <p className="text-sm text-grey-400 truncate">
                              {session.activities[0].window_title}
                              {hasMultipleActivities && (
                                <span className="text-grey-500 ml-2">
                                  +{session.activity_count - 1} more
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-grey-400">
                            {formatTime(session.start_time)} -{" "}
                            {formatTime(session.end_time)}
                          </p>
                          <p className="font-medium">
                            {formatDuration(session.total_duration)}
                          </p>
                        </div>
                      </div>

                      <div
                        className="grid transition-all duration-300 ease-out"
                        style={{
                          gridTemplateRows: isExpanded ? '1fr' : '0fr',
                        }}
                      >
                        <div className="overflow-hidden">
                          <div className="mt-4 ml-5 pl-4 border-l border-grey-700 space-y-3">
                            {session.activities.map((activity, index) => (
                              <div
                                key={activity.id}
                                className="flex items-start gap-4 py-2 transition-all duration-300"
                                style={{
                                  opacity: isExpanded ? 1 : 0,
                                  transform: isExpanded ? 'translateY(0)' : 'translateY(-10px)',
                                  transitionDelay: isExpanded ? `${index * 50}ms` : '0ms',
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-grey-300 truncate">
                                    {activity.window_title}
                                  </p>
                                  {activity.url && (
                                    <p className="text-xs text-info truncate">
                                      {activity.url}
                                    </p>
                                  )}
                                  {activity.project_name && (
                                    <p className="text-xs text-purple">
                                      Project: {activity.project_name}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right text-xs text-grey-400">
                                  <p>
                                    {formatTime(activity.start_time)} -{" "}
                                    {formatTime(activity.end_time)}
                                  </p>
                                  <p>{formatDuration(activity.duration)}</p>
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
