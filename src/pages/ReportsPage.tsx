import { useEffect, useState, useMemo } from "react";
import Plot from "react-plotly.js";
import { Card, ScoreCircle } from "../components";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchDashboardData,
  setDateRangeWeek,
  setDateRangeMonth,
  setCurrentActivity,
} from "../store/slices";
import { formatDuration, getPercentage } from "../utils/time";
import type { DailyTotal, HourlyPattern, CategoryBreakdown, CategoryInfo } from "../types/electron";

interface Insights {
  focusScore: number;
  mostProductiveHour: string | null;
  averageDailyTime: number;
  productiveTime: number;
  distractedTime: number;
  topProductivityDay: string | null;
  trend: "up" | "down" | "stable";
  trendPercentage: number;
  currentStreak: number;
  longestStreak: number;
}

// Calculate streak of consecutive productive days (days with >= 2 hours tracked)
function calculateStreaks(dailyTotals: DailyTotal[]): { currentStreak: number; longestStreak: number } {
  if (dailyTotals.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Sort by date descending (most recent first)
  const sorted = [...dailyTotals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const MIN_PRODUCTIVE_MS = 2 * 60 * 60 * 1000; // 2 hours minimum to count as productive day
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Check if today or yesterday is included (allow 1 day gap for current streak)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let lastDate: Date | null = null;
  let isCurrentStreakActive = true;

  for (const day of sorted) {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    const isProductive = day.total_duration >= MIN_PRODUCTIVE_MS;

    if (lastDate === null) {
      // First day - check if it's recent enough for current streak
      const daysSinceToday = Math.floor((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
      isCurrentStreakActive = daysSinceToday <= 1;

      if (isProductive) {
        tempStreak = 1;
        if (isCurrentStreakActive) currentStreak = 1;
      }
    } else {
      const daysDiff = Math.floor((lastDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1 && isProductive) {
        // Consecutive day
        tempStreak++;
        if (isCurrentStreakActive) currentStreak = tempStreak;
      } else if (daysDiff === 1 && !isProductive) {
        // Consecutive but not productive - streak broken
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
        isCurrentStreakActive = false;
      } else {
        // Gap in days - streak broken
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = isProductive ? 1 : 0;
        isCurrentStreakActive = false;
      }
    }

    lastDate = dayDate;
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
}

function calculateInsights(
  categoryBreakdown: CategoryBreakdown[],
  dailyTotals: DailyTotal[],
  hourlyPattern: HourlyPattern[],
  totalTime: number,
  categorySettings: Map<string, CategoryInfo>,
): Insights {
  const productiveTime = categoryBreakdown
    .filter((c) => categorySettings.get(c.category_name)?.productivityType === "productive")
    .reduce((sum, c) => sum + c.total_duration, 0);

  const distractedTime = categoryBreakdown
    .filter((c) => categorySettings.get(c.category_name)?.productivityType === "distraction")
    .reduce((sum, c) => sum + c.total_duration, 0);

  const focusScore = totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;

  const hourlyProductivity = new Map<number, number>();
  hourlyPattern.forEach((h) => {
    if (categorySettings.get(h.category_name)?.productivityType === "productive") {
      const hourNum = parseInt(h.hour);
      // Only consider work hours (6 AM - 11 PM)
      if (hourNum >= 6 && hourNum <= 23) {
        hourlyProductivity.set(hourNum, (hourlyProductivity.get(hourNum) || 0) + h.total_duration);
      }
    }
  });

  let mostProductiveHour: string | null = null;
  let maxProductivity = 0;
  let peakHourNum = -1;
  hourlyProductivity.forEach((duration, hour) => {
    // Only consider hours with at least 1 minute of productive time
    if (duration > maxProductivity && duration >= 60000) {
      maxProductivity = duration;
      peakHourNum = hour;
    }
  });

  if (peakHourNum >= 6 && maxProductivity > 0) {
    mostProductiveHour = peakHourNum < 12 ? `${peakHourNum} AM` : peakHourNum === 12 ? "12 PM" : `${peakHourNum - 12} PM`;
  }

  const averageDailyTime = dailyTotals.length > 0
    ? dailyTotals.reduce((sum, d) => sum + d.total_duration, 0) / dailyTotals.length
    : 0;

  const topProductivityDay = dailyTotals.length > 0
    ? dailyTotals.reduce((max, d) => (d.total_duration > max.total_duration ? d : max), dailyTotals[0]).date
    : null;

  let trend: "up" | "down" | "stable" = "stable";
  let trendPercentage = 0;

  if (dailyTotals.length >= 14) {
    const recent = dailyTotals.slice(0, 7).reduce((sum, d) => sum + d.total_duration, 0);
    const previous = dailyTotals.slice(7, 14).reduce((sum, d) => sum + d.total_duration, 0);
    if (previous > 0) {
      trendPercentage = Math.round(((recent - previous) / previous) * 100);
      trend = trendPercentage > 5 ? "up" : trendPercentage < -5 ? "down" : "stable";
    }
  }

  const { currentStreak, longestStreak } = calculateStreaks(dailyTotals);

  return {
    focusScore,
    mostProductiveHour,
    averageDailyTime,
    productiveTime,
    distractedTime,
    topProductivityDay,
    trend,
    trendPercentage,
    currentStreak,
    longestStreak,
  };
}

export function ReportsPage() {
  const dispatch = useAppDispatch();
  const { appUsage, categoryBreakdown, totalTime, dateRange } = useAppSelector(
    (state) => state.tracking
  );
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "details">("overview");
  const [dateMode, setDateMode] = useState<"week" | "month">("week");

  // Build a lookup map from category name → settings (productivityType etc.)
  const categorySettings = useMemo(() => {
    const map = new Map<string, CategoryInfo>();
    categories.forEach((c) => map.set(c.name, c));
    return map;
  }, [categories]);

  useEffect(() => {
    if (dateMode === "week") {
      dispatch(setDateRangeWeek());
    } else {
      dispatch(setDateRangeMonth());
    }
  }, [dispatch, dateMode]);

  useEffect(() => {
    dispatch(fetchDashboardData({ start: dateRange.start, end: dateRange.end }));
    window.electronAPI.getDailyTotals(30).then(setDailyTotals);
    window.electronAPI.getHourlyPattern(dateRange.start, dateRange.end).then(setHourlyPattern);
    window.electronAPI.getCategories().then(setCategories);

    const unsubscribe = window.electronAPI.onActivityChanged((activity) => {
      dispatch(setCurrentActivity(activity));
      dispatch(fetchDashboardData({ start: dateRange.start, end: Date.now() }));
      window.electronAPI.getDailyTotals(30).then(setDailyTotals);
      window.electronAPI.getHourlyPattern(dateRange.start, Date.now()).then(setHourlyPattern);
    });

    return () => unsubscribe();
  }, [dispatch, dateRange]);

  const insights = useMemo(
    () => calculateInsights(categoryBreakdown, dailyTotals, hourlyPattern, totalTime, categorySettings),
    [categoryBreakdown, dailyTotals, hourlyPattern, totalTime, categorySettings]
  );

  const heatmapData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    // Build category list from actual data
    const categoryNames = [...new Set(hourlyPattern.map((h) => h.category_name))];
    const matrix: number[][] = categoryNames.map(() => new Array(24).fill(0));

    hourlyPattern.forEach((h) => {
      const hourIdx = parseInt(h.hour);
      const catIdx = categoryNames.indexOf(h.category_name);
      if (catIdx !== -1 && hourIdx >= 0 && hourIdx < 24) {
        matrix[catIdx][hourIdx] = h.total_duration / (1000 * 60);
      }
    });

    return { hours, categories: categoryNames, matrix };
  }, [hourlyPattern]);

  const dailyChartData = useMemo(() => {
    const sortedDays = [...dailyTotals].reverse().slice(-14);
    return {
      dates: sortedDays.map((d) => d.date),
      durations: sortedDays.map((d) => d.total_duration / (1000 * 60 * 60)),
    };
  }, [dailyTotals]);

  const plotLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#71717a", size: 11 },
    margin: { t: 20, r: 30, b: 60, l: 60 },
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Reports</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateMode("week")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              dateMode === "week"
                ? "bg-white/10 text-white"
                : "text-grey-400 hover:text-white"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setDateMode("month")}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${
              dateMode === "month"
                ? "bg-white/10 text-white"
                : "text-grey-400 hover:text-white"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Insights Summary */}
      <Card className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Productivity Insights</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
          <div>
            <ScoreCircle
              score={insights.focusScore}
              label="Focus Score"
              subLabel={insights.focusScore >= 70 ? "Excellent" : insights.focusScore >= 50 ? "Good" : "Needs work"}
              color="#8b5cf6"
            />
          </div>
          <div>
            <p className="text-[11px] text-grey-500 mb-1">Peak Productivity</p>
            <p className="text-2xl font-semibold text-white">{insights.mostProductiveHour || "-"}</p>
            <p className="text-xs text-grey-500">Most focused hour</p>
          </div>
          <div>
            <p className="text-[11px] text-grey-500 mb-1">Daily Average</p>
            <p className="text-2xl font-semibold text-white">{formatDuration(insights.averageDailyTime)}</p>
            <p className="text-xs text-grey-500">Time tracked per day</p>
          </div>
          <div>
            <p className="text-[11px] text-grey-500 mb-1">Weekly Trend</p>
            <p className={`text-2xl font-semibold ${
              insights.trend === "up" ? "text-success" : insights.trend === "down" ? "text-error" : "text-grey-400"
            }`}>
              {insights.trend === "up" ? "+" : insights.trend === "down" ? "" : ""}
              {insights.trendPercentage}%
            </p>
            <p className="text-xs text-grey-500">
              {insights.trend === "up" ? "More active" : insights.trend === "down" ? "Less active" : "Consistent"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-grey-500 mb-1">Streak</p>
            <p className="text-2xl font-semibold text-white flex items-center gap-2">
              {insights.currentStreak}
              {insights.currentStreak >= 3 && <span className="text-lg">🔥</span>}
              {insights.currentStreak >= 7 && <span className="text-lg">⭐</span>}
            </p>
            <p className="text-xs text-grey-500">
              {insights.currentStreak === 0
                ? "Start a streak today!"
                : insights.currentStreak === 1
                  ? "day • Best: " + insights.longestStreak
                  : "days • Best: " + insights.longestStreak}
            </p>
          </div>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm rounded-md transition-all ${
            activeTab === "overview"
              ? "bg-white/10 text-white"
              : "text-grey-400 hover:text-white"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm rounded-md transition-all ${
            activeTab === "details"
              ? "bg-white/10 text-white"
              : "text-grey-400 hover:text-white"
          }`}
        >
          Detailed Analysis
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Category Pie Chart */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Time Distribution</p>
            {categoryBreakdown.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-grey-400 text-sm mb-1">No time distribution data</p>
                  <p className="text-grey-600 text-xs">Track activities to see category breakdown</p>
                </div>
              </div>
            ) : (
              <Plot
                data={[
                  {
                    type: "pie",
                    values: categoryBreakdown.map((c) => c.total_duration),
                    labels: categoryBreakdown.map((c) => c.category_name),
                    marker: {
                      colors: categoryBreakdown.map((c) => c.category_color),
                    },
                    textinfo: "percent",
                    textposition: "inside",
                    textfont: { color: "#fff", size: 11 },
                    hovertemplate: "%{label}<br>%{percent}<extra></extra>",
                    hole: 0.5,
                  },
                ]}
                layout={{
                  ...plotLayout,
                  showlegend: true,
                  legend: { orientation: "h", y: -0.15, font: { color: "#71717a", size: 10 } },
                  height: 280,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "280px" }}
              />
            )}
          </Card>

          {/* Daily Activity Bar Chart with Trend Line */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Daily Activity & Trend</p>
            {dailyChartData.dates.length === 0 || dailyChartData.durations.every(d => d === 0) ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-grey-400 text-sm mb-1">No daily activity data</p>
                  <p className="text-grey-600 text-xs">Data will appear after a day of tracking</p>
                </div>
              </div>
            ) : (
              <Plot
                data={[
                  {
                    type: "bar",
                    name: "Daily Hours",
                    x: dailyChartData.dates.map(d => {
                      const date = new Date(d);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }),
                    y: dailyChartData.durations,
                    marker: {
                      color: dailyChartData.durations.map((d) =>
                        d >= 6 ? "#22c55e" : d >= 4 ? "#8b5cf6" : "#52525b"
                      ),
                      line: { color: "rgba(139,92,246,0.3)", width: 1 },
                    },
                    hovertemplate: "%{x}<br>%{y:.1f} hours<extra></extra>",
                  },
                  // 3-day moving average trend line
                  {
                    type: "scatter",
                    mode: "lines",
                    name: "3-day Avg",
                    x: dailyChartData.dates.map(d => {
                      const date = new Date(d);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }),
                    y: dailyChartData.durations.map((_, i, arr) => {
                      if (i < 2) return null;
                      return (arr[i] + arr[i - 1] + arr[i - 2]) / 3;
                    }),
                    line: { color: "#f97316", width: 2, shape: "spline" },
                    hovertemplate: "Avg: %{y:.1f}h<extra></extra>",
                  },
                ]}
                layout={{
                  ...plotLayout,
                  height: 280,
                  showlegend: true,
                  legend: { orientation: "h", y: 1.1, font: { color: "#71717a", size: 10 } },
                  xaxis: {
                    tickangle: -45,
                    tickfont: { size: 9, color: "#71717a" },
                    gridcolor: "rgba(39,39,42,0.3)",
                    showgrid: false,
                    zeroline: false,
                  },
                  yaxis: {
                    title: { text: "Hours", font: { size: 10, color: "#71717a" } },
                    gridcolor: "rgba(39,39,42,0.3)",
                    tickfont: { color: "#71717a" },
                    zeroline: false,
                    rangemode: "tozero",
                  },
                  bargap: 0.3,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "280px" }}
              />
            )}
          </Card>

          {/* Productivity Breakdown */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Productivity Breakdown</p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-success">Productive</span>
                  <span className="text-grey-400">{formatDuration(insights.productiveTime)}</span>
                </div>
                <div className="h-2 bg-grey-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${totalTime > 0 ? (insights.productiveTime / totalTime) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-error">Distracting</span>
                  <span className="text-grey-400">{formatDuration(insights.distractedTime)}</span>
                </div>
                <div className="h-2 bg-grey-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-error rounded-full transition-all"
                    style={{ width: `${totalTime > 0 ? (insights.distractedTime / totalTime) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-grey-400">Neutral</span>
                  <span className="text-grey-400">
                    {formatDuration(totalTime - insights.productiveTime - insights.distractedTime)}
                  </span>
                </div>
                <div className="h-2 bg-grey-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-grey-600 rounded-full transition-all"
                    style={{
                      width: `${totalTime > 0 ? ((totalTime - insights.productiveTime - insights.distractedTime) / totalTime) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Top Apps */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Top Applications</p>
            {appUsage.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-grey-400 text-sm mb-1">No app usage data</p>
                  <p className="text-grey-600 text-xs">Your top apps will appear here</p>
                </div>
              </div>
            ) : (
              <Plot
                data={[
                  {
                    type: "bar",
                    y: appUsage.slice(0, 8).map((a) => a.app_name),
                    x: appUsage.slice(0, 8).map((a) => a.total_duration / (1000 * 60 * 60)),
                    orientation: "h",
                    marker: { color: "#8b5cf6" },
                    hovertemplate: "%{y}<br>%{x:.1f} hours<extra></extra>",
                  },
                ]}
                layout={{
                  ...plotLayout,
                  height: 260,
                  xaxis: { title: { text: "Hours", font: { size: 10 } }, gridcolor: "#27272a" },
                  yaxis: { autorange: "reversed", tickfont: { size: 10 } },
                  margin: { ...plotLayout.margin, l: 100 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "260px" }}
              />
            )}
          </Card>
        </div>
      )}

      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Summary Stats - First */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Summary</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <div>
                <p className="text-[11px] text-grey-500 mb-1">Total Tracked</p>
                <p className="text-2xl font-semibold text-white">{formatDuration(totalTime)}</p>
              </div>
              <div>
                <p className="text-[11px] text-grey-500 mb-1">Days Tracked</p>
                <p className="text-2xl font-semibold text-white">
                  {dailyTotals.filter((d) => d.total_duration > 0).length}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-grey-500 mb-1">Most Active Day</p>
                <p className="text-2xl font-semibold text-white">{insights.topProductivityDay || "-"}</p>
              </div>
              <div>
                <p className="text-[11px] text-grey-500 mb-1">Productive Time</p>
                <p className="text-2xl font-semibold text-white">{formatDuration(insights.productiveTime)}</p>
              </div>
            </div>
          </Card>

          {/* Category Details Table - Second */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Category Details</p>
            {categoryBreakdown.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-grey-400 text-sm mb-1">No category details</p>
                <p className="text-grey-600 text-xs">Track activities to see detailed breakdown</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-grey-500 border-b border-white/[0.06]">
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium">Percentage</th>
                      <th className="pb-3 font-medium">Sessions</th>
                      <th className="pb-3 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map((cat) => (
                      <tr key={cat.category_id} className="border-b border-white/[0.04]">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: cat.category_color }}
                            />
                            <span className="capitalize text-white">{cat.category_name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-grey-400">{formatDuration(cat.total_duration)}</td>
                        <td className="py-3 text-grey-400">{getPercentage(cat.total_duration, totalTime)}%</td>
                        <td className="py-3 text-grey-400">{cat.session_count}</td>
                        <td className="py-3">
                          {categorySettings.get(cat.category_name)?.productivityType === "productive" ? (
                            <span className="text-success text-xs">Productive</span>
                          ) : categorySettings.get(cat.category_name)?.productivityType === "distraction" ? (
                            <span className="text-error text-xs">Distracting</span>
                          ) : (
                            <span className="text-grey-500 text-xs">Neutral</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Hourly Heatmap - Last */}
          <Card>
            <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-2">Hourly Activity Heatmap</p>
            <p className="text-xs text-grey-600 mb-4">Activity by category throughout the day (minutes)</p>
            {hourlyPattern.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <p className="text-grey-400 text-sm mb-1">No hourly pattern data</p>
                  <p className="text-grey-600 text-xs">Activity heatmap will appear after tracking</p>
                </div>
              </div>
            ) : (
              <Plot
                data={[
                  {
                    type: "heatmap",
                    z: heatmapData.matrix,
                    x: heatmapData.hours.map((h) => {
                      const hour = parseInt(h);
                      return hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`;
                    }),
                    y: heatmapData.categories,
                    colorscale: [
                      [0, "#18181b"],
                      [0.25, "#312e81"],
                      [0.5, "#6d28d9"],
                      [0.75, "#8b5cf6"],
                      [1, "#c4b5fd"],
                    ],
                    hovertemplate: "%{y} at %{x}<br>%{z:.0f} minutes<extra></extra>",
                  },
                ]}
                layout={{
                  ...plotLayout,
                  height: 320,
                  margin: { t: 20, r: 60, b: 40, l: 110 },
                  xaxis: { tickfont: { size: 9, color: "#71717a" } },
                  yaxis: { tickfont: { size: 10, color: "#71717a" } },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "320px" }}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
