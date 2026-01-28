import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type {
  CurrentActivity,
  TrackerStatus,
  AppUsage,
  CategoryBreakdown,
  ProjectTime,
  DomainUsage,
  ActivityRecord,
  SessionWithActivities,
} from "../../types/electron";

interface TrackingState {
  status: TrackerStatus | null;
  currentActivity: CurrentActivity | null;
  appUsage: AppUsage[];
  categoryBreakdown: CategoryBreakdown[];
  projectTime: ProjectTime[];
  domainUsage: DomainUsage[];
  activities: ActivityRecord[];
  sessions: SessionWithActivities[];
  totalTime: number;
  isLoading: boolean;
  error: string | null;
  dateRange: {
    start: number;
    end: number;
  };
}

const getStartOfDay = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

const initialState: TrackingState = {
  status: null,
  currentActivity: null,
  appUsage: [],
  categoryBreakdown: [],
  projectTime: [],
  domainUsage: [],
  activities: [],
  sessions: [],
  totalTime: 0,
  isLoading: false,
  error: null,
  dateRange: {
    start: getStartOfDay(),
    end: Date.now(),
  },
};

export const fetchTrackerStatus = createAsyncThunk(
  "tracking/fetchStatus",
  async () => {
    return await window.electronAPI.getTrackerStatus();
  },
);

export const fetchDashboardData = createAsyncThunk(
  "tracking/fetchDashboardData",
  async ({ start, end }: { start: number; end: number }) => {
    const [appUsage, categoryBreakdown, projectTime, domainUsage, totalTime] =
      await Promise.all([
        window.electronAPI.getAppUsage(start, end),
        window.electronAPI.getCategoryBreakdown(start, end),
        window.electronAPI.getProjectTime(start, end),
        window.electronAPI.getDomainUsage(start, end),
        window.electronAPI.getTotalTime(start, end),
      ]);

    return {
      appUsage,
      categoryBreakdown,
      projectTime,
      domainUsage,
      totalTime,
    };
  },
);

export const fetchActivities = createAsyncThunk(
  "tracking/fetchActivities",
  async ({ start, end }: { start: number; end: number }) => {
    return await window.electronAPI.getActivities(start, end);
  },
);

export const fetchSessions = createAsyncThunk(
  "tracking/fetchSessions",
  async ({ start, end }: { start: number; end: number }) => {
    return await window.electronAPI.getSessions(start, end);
  },
);

const trackingSlice = createSlice({
  name: "tracking",
  initialState,
  reducers: {
    setCurrentActivity: (state, action: PayloadAction<CurrentActivity | null>) => {
      state.currentActivity = action.payload;
    },
    setDateRange: (state, action: PayloadAction<{ start: number; end: number }>) => {
      state.dateRange = action.payload;
    },
    setDateRangeToday: (state) => {
      state.dateRange = {
        start: getStartOfDay(),
        end: Date.now(),
      };
    },
    setDateRangeWeek: (state) => {
      const now = Date.now();
      state.dateRange = {
        start: now - 7 * 24 * 60 * 60 * 1000,
        end: now,
      };
    },
    setDateRangeMonth: (state) => {
      const now = Date.now();
      state.dateRange = {
        start: now - 30 * 24 * 60 * 60 * 1000,
        end: now,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrackerStatus.fulfilled, (state, action) => {
        state.status = action.payload;
        if (action.payload?.currentActivity) {
          state.currentActivity = action.payload.currentActivity;
        }
      })
      .addCase(fetchDashboardData.pending, (state) => {
        // Only show loading on initial load, not background refreshes
        if (state.appUsage.length === 0 && state.categoryBreakdown.length === 0) {
          state.isLoading = true;
        }
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appUsage = action.payload.appUsage;
        state.categoryBreakdown = action.payload.categoryBreakdown;
        state.projectTime = action.payload.projectTime;
        state.domainUsage = action.payload.domainUsage;
        state.totalTime = action.payload.totalTime;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to fetch data";
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.activities = action.payload;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.sessions = action.payload;
      });
  },
});

export const {
  setCurrentActivity,
  setDateRange,
  setDateRangeToday,
  setDateRangeWeek,
  setDateRangeMonth,
} = trackingSlice.actions;

export default trackingSlice.reducer;
