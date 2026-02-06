import { useEffect, useState, useMemo } from "react";
import { Card } from "../components";
import { formatDuration } from "../utils/time";
import type { DailyTotal, CategoryBreakdown } from "../types/electron";

interface DayData {
  date: string;
  totalTime: number;
  hours: number;
  productivityLevel: "none" | "low" | "medium" | "high" | "excellent";
}

interface DayDetails {
  date: string;
  totalTime: number;
  categories: CategoryBreakdown[];
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getProductivityLevel(hours: number): DayData["productivityLevel"] {
  if (hours === 0) return "none";
  if (hours < 2) return "low";
  if (hours < 4) return "medium";
  if (hours < 6) return "high";
  return "excellent";
}

// Calculate actual productivity based on category types
function calculateProductivityScore(categories: CategoryBreakdown[]): {
  productiveTime: number;
  distractionTime: number;
  neutralTime: number;
  totalTime: number;
  score: number; // -1 to 1 scale: -1 = all distraction, 0 = neutral, 1 = all productive
} {
  let productiveTime = 0;
  let distractionTime = 0;
  let neutralTime = 0;

  for (const cat of categories) {
    if (cat.productivity_type === "productive") {
      productiveTime += cat.total_duration;
    } else if (cat.productivity_type === "distraction") {
      distractionTime += cat.total_duration;
    } else {
      neutralTime += cat.total_duration;
    }
  }

  const totalTime = productiveTime + distractionTime + neutralTime;
  // Score: (productive - distraction) / total, ranges from -1 to 1
  const score = totalTime > 0 ? (productiveTime - distractionTime) / totalTime : 0;

  return { productiveTime, distractionTime, neutralTime, totalTime, score };
}

type ActualProductivityLevel = "none" | "distracted" | "mixed" | "neutral" | "focused" | "productive";

function getActualProductivityLevel(categories: CategoryBreakdown[]): ActualProductivityLevel {
  if (categories.length === 0) return "none";

  const { score, totalTime, productiveTime, distractionTime } = calculateProductivityScore(categories);

  if (totalTime === 0) return "none";

  // If mostly distractions (score < -0.3)
  if (score < -0.3) return "distracted";
  // If mixed (some productive, some distraction)
  if (score < 0.2 && productiveTime > 0 && distractionTime > 0) return "mixed";
  // If mostly neutral
  if (productiveTime === 0 && distractionTime === 0) return "neutral";
  // If somewhat productive
  if (score < 0.6) return "focused";
  // Highly productive
  return "productive";
}

function getProductivityGradient(level: DayData["productivityLevel"]): string {
  switch (level) {
    case "none": return "from-transparent to-transparent";
    case "low": return "from-violet-950/60 to-violet-900/40";
    case "medium": return "from-violet-800/70 to-violet-700/50";
    case "high": return "from-violet-600/80 to-violet-500/60";
    case "excellent": return "from-violet-500/90 to-fuchsia-500/70";
  }
}

function getProductivityBorder(level: DayData["productivityLevel"]): string {
  switch (level) {
    case "none": return "border-white/[0.04]";
    case "low": return "border-violet-700/30";
    case "medium": return "border-violet-600/40";
    case "high": return "border-violet-500/50";
    case "excellent": return "border-violet-400/60";
  }
}

function getProductivityDot(level: DayData["productivityLevel"]): string {
  switch (level) {
    case "none": return "bg-grey-700";
    case "low": return "bg-violet-700";
    case "medium": return "bg-violet-500";
    case "high": return "bg-violet-400";
    case "excellent": return "bg-fuchsia-400";
  }
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch daily totals for the current month
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const totals = await window.electronAPI.getDailyTotals(90);
      setDailyTotals(totals);
      setIsLoading(false);
    };
    fetchData();
  }, [month, year]);

  // Build calendar grid data
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const dateMap = new Map<string, number>();
    dailyTotals.forEach((d) => {
      dateMap.set(d.date, d.total_duration);
    });

    const days: (DayData | null)[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split("T")[0];
      const totalTime = dateMap.get(dateStr) ?? 0;
      const hours = totalTime / 3600000;

      days.push({
        date: dateStr,
        totalTime,
        hours,
        productivityLevel: getProductivityLevel(hours),
      });
    }

    return days;
  }, [year, month, dailyTotals]);

  // Monthly stats
  const monthStats = useMemo(() => {
    const monthDays = calendarData.filter((d): d is DayData => d !== null);
    const totalTime = monthDays.reduce((sum, d) => sum + d.totalTime, 0);
    const activeDays = monthDays.filter((d) => d.totalTime > 0).length;
    const avgTime = activeDays > 0 ? totalTime / activeDays : 0;
    const bestDay = monthDays.reduce((best, d) => d.totalTime > best.totalTime ? d : best, monthDays[0] || { totalTime: 0, date: "" });

    return { totalTime, activeDays, avgTime, bestDay };
  }, [calendarData]);

  const handleDayClick = async (dayData: DayData) => {
    if (dayData.totalTime === 0) {
      setSelectedDay({
        date: dayData.date,
        totalTime: 0,
        categories: [],
      });
      return;
    }

    setIsLoadingDetails(true);
    const date = new Date(dayData.date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const categories = await window.electronAPI.getCategoryBreakdown(
      startOfDay.getTime(),
      endOfDay.getTime()
    );

    // Debug: log to verify productivity_type is coming through
    console.log("Categories with productivity_type:", categories.map(c => ({
      name: c.category_name,
      productivity_type: c.productivity_type,
      duration: c.total_duration
    })));

    setSelectedDay({
      date: dayData.date,
      totalTime: dayData.totalTime,
      categories,
    });
    setIsLoadingDetails(false);
  };

  const navigateMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  const isToday = (dateStr: string) => {
    return dateStr === new Date().toISOString().split("T")[0];
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Calendar</h2>
          <p className="text-sm text-grey-500 mt-0.5">Track your productivity over time</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg text-grey-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-1.5 text-sm text-grey-300 hover:text-white hover:bg-white/10 rounded-lg transition-all font-medium"
          >
            Today
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg text-grey-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <span className="px-3 text-base font-semibold text-white">
            {MONTHS[month]} {year}
          </span>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wider text-grey-500 mb-1">Total Time</p>
          <p className="text-xl font-semibold text-white">{formatDuration(monthStats.totalTime)}</p>
        </div>
        <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wider text-grey-500 mb-1">Active Days</p>
          <p className="text-xl font-semibold text-white">{monthStats.activeDays} <span className="text-sm text-grey-500 font-normal">days</span></p>
        </div>
        <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wider text-grey-500 mb-1">Daily Average</p>
          <p className="text-xl font-semibold text-white">{formatDuration(monthStats.avgTime)}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 rounded-xl p-4 border border-violet-500/20">
          <p className="text-[10px] uppercase tracking-wider text-violet-400 mb-1">Best Day</p>
          <p className="text-xl font-semibold text-white">
            {monthStats.bestDay?.totalTime > 0 ? formatDuration(monthStats.bestDay.totalTime) : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-2">
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="h-[420px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  <span className="text-sm text-grey-500">Loading calendar...</span>
                </div>
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day}
                      className="text-center text-[10px] uppercase tracking-widest text-grey-500 font-medium py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarData.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const isSelected = selectedDay?.date === day.date;
                    const isTodayDate = isToday(day.date);
                    const dayNum = new Date(day.date).getDate();

                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDayClick(day)}
                        className={`
                          group relative aspect-square rounded-xl border transition-all duration-200
                          bg-gradient-to-br ${getProductivityGradient(day.productivityLevel)}
                          ${getProductivityBorder(day.productivityLevel)}
                          ${isSelected ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-[#09090b] scale-105 z-10" : ""}
                          ${isTodayDate && !isSelected ? "ring-1 ring-white/40" : ""}
                          hover:scale-105 hover:z-10 hover:shadow-lg hover:shadow-violet-500/10
                          flex flex-col items-center justify-center
                        `}
                      >
                        {/* Today indicator */}
                        {isTodayDate && (
                          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        )}

                        {/* Day number */}
                        <span className={`
                          text-sm font-semibold transition-colors
                          ${day.totalTime > 0 ? "text-white" : "text-grey-600 group-hover:text-grey-400"}
                        `}>
                          {dayNum}
                        </span>

                        {/* Hours indicator */}
                        {day.totalTime > 0 && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <div className={`w-1 h-1 rounded-full ${getProductivityDot(day.productivityLevel)}`} />
                            <span className="text-[10px] text-grey-400 font-medium">
                              {day.hours >= 1 ? `${Math.round(day.hours)}h` : `${Math.round(day.hours * 60)}m`}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-5 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-grey-500 uppercase tracking-wider">Less</span>
                    <div className="flex gap-1">
                      {(["none", "low", "medium", "high", "excellent"] as const).map((level) => (
                        <div
                          key={level}
                          className={`w-5 h-5 rounded-md bg-gradient-to-br ${getProductivityGradient(level)} border ${getProductivityBorder(level)} transition-transform hover:scale-110`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-grey-500 uppercase tracking-wider">More</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Day Details Panel */}
        <div>
          <Card className="sticky top-6">
            {!selectedDay ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-grey-300 font-medium mb-1">Select a Day</p>
                <p className="text-grey-600 text-sm">Click on any day to view details</p>
              </div>
            ) : isLoadingDetails ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 mx-auto border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                {/* Date header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getProductivityGradient(getProductivityLevel(selectedDay.totalTime / 3600000))} border ${getProductivityBorder(getProductivityLevel(selectedDay.totalTime / 3600000))} flex items-center justify-center`}>
                    <span className="text-sm font-bold text-white">
                      {new Date(selectedDay.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{formatDateLabel(selectedDay.date)}</p>
                    <p className="text-xs text-grey-500">
                      {isToday(selectedDay.date) ? "Today" : new Date(selectedDay.date).getFullYear()}
                    </p>
                  </div>
                </div>

                {selectedDay.totalTime === 0 ? (
                  <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                    <svg className="w-10 h-10 mx-auto text-grey-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-grey-500 text-sm">No activity recorded</p>
                  </div>
                ) : (
                  <>
                    {/* Total time - prominent display */}
                    <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 rounded-xl p-4 border border-violet-500/20 mb-5">
                      <p className="text-[10px] uppercase tracking-wider text-violet-400 mb-1">Total Time</p>
                      <p className="text-3xl font-bold text-white">{formatDuration(selectedDay.totalTime)}</p>
                    </div>

                    {/* Category breakdown */}
                    <div className="mb-5">
                      <p className="text-[10px] uppercase tracking-wider text-grey-500 mb-3">Categories</p>
                      <div className="space-y-2.5">
                        {selectedDay.categories.map((cat, index) => {
                          const percent = Math.round((cat.total_duration / selectedDay.totalTime) * 100);
                          return (
                            <div
                              key={cat.category_id}
                              className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-[#111113]"
                                style={{ backgroundColor: cat.category_color, ringColor: `${cat.category_color}40` }}
                              />
                              <span className="text-sm text-grey-300 flex-1 truncate capitalize group-hover:text-white transition-colors">
                                {cat.category_name.replace(/_/g, " ")}
                              </span>
                              <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${percent}%`,
                                    backgroundColor: cat.category_color,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-grey-500 w-12 text-right font-medium">
                                {formatDuration(cat.total_duration)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Productivity badge */}
                    <div className="pt-4 border-t border-white/[0.06]">
                      {(() => {
                        const level = getActualProductivityLevel(selectedDay.categories);
                        const { productiveTime, distractionTime } = calculateProductivityScore(selectedDay.categories);
                        const hours = selectedDay.totalTime / 3600000;

                        const badgeConfig: Record<ActualProductivityLevel, { text: string; emoji: string; gradient: string; border: string; subtext: string }> = {
                          none: {
                            text: "No Activity",
                            emoji: "😴",
                            gradient: "from-transparent to-transparent",
                            border: "border-white/[0.04]",
                            subtext: "No time tracked"
                          },
                          distracted: {
                            text: "Distraction Day",
                            emoji: "📱",
                            gradient: "from-red-500/20 to-orange-500/20",
                            border: "border-red-500/30",
                            subtext: `${formatDuration(distractionTime)} on distractions`
                          },
                          mixed: {
                            text: "Mixed Focus",
                            emoji: "⚖️",
                            gradient: "from-amber-500/20 to-yellow-500/20",
                            border: "border-amber-500/30",
                            subtext: `${formatDuration(productiveTime)} productive, ${formatDuration(distractionTime)} distracted`
                          },
                          neutral: {
                            text: "Neutral Activity",
                            emoji: "🌱",
                            gradient: "from-slate-500/20 to-slate-400/20",
                            border: "border-slate-500/30",
                            subtext: `${hours.toFixed(1)} hours tracked`
                          },
                          focused: {
                            text: "Good Focus",
                            emoji: "💪",
                            gradient: "from-emerald-500/20 to-teal-500/20",
                            border: "border-emerald-500/30",
                            subtext: `${formatDuration(productiveTime)} productive`
                          },
                          productive: {
                            text: "Highly Productive!",
                            emoji: "🔥",
                            gradient: "from-violet-500/20 to-fuchsia-500/20",
                            border: "border-violet-500/30",
                            subtext: `${formatDuration(productiveTime)} of focused work`
                          },
                        };

                        const { text, emoji, gradient, border, subtext } = badgeConfig[level];
                        return (
                          <div className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br ${gradient} border ${border}`}>
                            <span className="text-2xl">{emoji}</span>
                            <div>
                              <p className="text-sm font-medium text-white">{text}</p>
                              <p className="text-xs text-grey-400">{subtext}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
