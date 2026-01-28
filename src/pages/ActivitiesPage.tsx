import { useEffect } from "react";
import { Card } from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchActivities, setDateRangeToday, setDateRangeWeek, setCurrentActivity } from "../store/slices";
import { formatDuration, formatTime } from "../utils/time";

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
  const { activities, dateRange } = useAppSelector((state) => state.tracking);

  useEffect(() => {
    dispatch(fetchActivities({ start: dateRange.start, end: dateRange.end }));

    // Listen for activity changes and refresh
    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchActivities({ start: dateRange.start, end: Date.now() }));
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, dateRange.start]);

  // Group activities by date
  const groupedActivities = activities.reduce(
    (groups, activity) => {
      const date = new Date(activity.start_time).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    },
    {} as Record<string, typeof activities>,
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

      {activities.length === 0 ? (
        <Card>
          <p className="text-grey-400 text-center py-8">
            No activities recorded yet. Start using your computer and activities will
            appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date}>
              <h3 className="text-lg font-medium mb-3 text-grey-300">{date}</h3>
              <div className="space-y-2">
                {dayActivities.map((activity) => (
                  <Card key={activity.id} className="!p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-1 h-full min-h-[60px] rounded-full"
                        style={{
                          backgroundColor: CATEGORY_COLORS[activity.category],
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{activity.app_name}</span>
                          <span
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{
                              backgroundColor:
                                CATEGORY_COLORS[activity.category] + "30",
                              color: CATEGORY_COLORS[activity.category],
                            }}
                          >
                            {activity.category}
                          </span>
                        </div>
                        <p className="text-sm text-grey-400 truncate mb-2">
                          {activity.window_title}
                        </p>
                        {activity.url && (
                          <p className="text-xs text-info truncate mb-2">
                            {activity.url}
                          </p>
                        )}
                        {activity.project_name && (
                          <p className="text-xs text-purple">
                            Project: {activity.project_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-grey-400">
                          {formatTime(activity.start_time)} -{" "}
                          {formatTime(activity.end_time)}
                        </p>
                        <p className="font-medium">
                          {formatDuration(activity.duration)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
