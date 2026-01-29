import { useEffect, useState } from "react";
import { Card } from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchDashboardData, setDateRangeWeek, setDateRangeMonth, setCurrentActivity } from "../store/slices";
import { formatDuration, getPercentage } from "../utils/time";
import type { DailyTotal } from "../types/electron";

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

export function ReportsPage() {
  const dispatch = useAppDispatch();
  const { appUsage, categoryBreakdown, domainUsage, totalTime, dateRange } =
    useAppSelector((state) => state.tracking);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);

  useEffect(() => {
    dispatch(setDateRangeWeek());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchDashboardData({ start: dateRange.start, end: dateRange.end }));
    window.electronAPI.getDailyTotals(30).then(setDailyTotals);

    // Listen for activity changes and refresh data
    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchDashboardData({ start: dateRange.start, end: Date.now() }));
      window.electronAPI.getDailyTotals(30).then(setDailyTotals);
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, dateRange]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Reports</h2>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch(setDateRangeWeek())}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary-light transition-colors"
          >
            Week
          </button>
          <button
            onClick={() => dispatch(setDateRangeMonth())}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary hover:bg-secondary-light transition-colors"
          >
            Month
          </button>
        </div>
      </div>

      {/* Summary */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-grey-400">Total Tracked</p>
            <p className="text-2xl font-bold">{formatDuration(totalTime)}</p>
          </div>
          <div>
            <p className="text-sm text-grey-400">Daily Average</p>
            <p className="text-2xl font-bold">
              {dailyTotals.length > 0
                ? formatDuration(
                    dailyTotals.reduce((sum, d) => sum + d.total_duration, 0) /
                      dailyTotals.length,
                  )
                : "0m"}
            </p>
          </div>
          <div>
            <p className="text-sm text-grey-400">Most Used App</p>
            <p className="text-2xl font-bold truncate">
              {appUsage[0]?.app_name || "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-grey-400">Top Category</p>
            <p className="text-2xl font-bold capitalize">
              {categoryBreakdown[0]?.category || "-"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Time by Category</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-grey-400">No data yet</p>
          ) : (
            <div className="space-y-4">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between mb-1">
                    <span className="capitalize flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[cat.category] }}
                      />
                      {cat.category}
                    </span>
                    <span className="text-grey-400">
                      {formatDuration(cat.total_duration)} (
                      {getPercentage(cat.total_duration, totalTime)}%)
                    </span>
                  </div>
                  <div className="h-3 bg-grey-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
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
          <h3 className="text-lg font-semibold mb-4">Top Applications</h3>
          {appUsage.length === 0 ? (
            <p className="text-grey-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {appUsage.slice(0, 10).map((app, index) => (
                <div key={app.app_name} className="flex items-center gap-3">
                  <span className="text-grey-500 w-6">{index + 1}.</span>
                  <span className="flex-1 truncate">{app.app_name}</span>
                  <span className="text-grey-400">
                    {formatDuration(app.total_duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Domains */}
        <Card variant="blue">
          <h3 className="text-lg font-semibold mb-4">Top Websites</h3>
          {domainUsage.length === 0 ? (
            <p className="text-grey-300">No browsing data yet</p>
          ) : (
            <div className="space-y-3">
              {domainUsage.slice(0, 10).map((domain, index) => (
                <div key={domain.domain} className="flex items-center gap-3">
                  <span className="text-grey-400 w-6">{index + 1}.</span>
                  <span className="flex-1 truncate">{domain.domain}</span>
                  <span className="text-grey-300">
                    {formatDuration(domain.total_duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Daily Activity */}
        <Card variant="green">
          <h3 className="text-lg font-semibold mb-4">Daily Activity</h3>
          {dailyTotals.length === 0 ? (
            <p className="text-grey-300">No daily data yet</p>
          ) : (
            <div className="space-y-2">
              {dailyTotals.slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-grey-300 w-24">{day.date}</span>
                  <div className="flex-1 h-4 bg-grey-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (day.total_duration / (8 * 60 * 60 * 1000)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-grey-300 w-16 text-right">
                    {formatDuration(day.total_duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
