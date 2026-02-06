import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { Sidebar } from './sections';
import { HomePage, ActivitiesPage, PomodoroPage, ReportsPage, CalendarPage, SettingsPage, OnboardingPage } from './pages';
import type { PermissionsStatus, UpdateStatus } from './types/electron';

function UpdateBanner({ status }: { status: UpdateStatus | null }) {
  if (!status || status.state === 'checking' || status.state === 'not-available') {
    return null;
  }

  if (status.state === 'available') {
    return (
      <div className="bg-primary/90 text-white px-4 py-2 flex items-center justify-between text-sm">
        <span>Update available: v{status.version}</span>
        <button
          onClick={() => window.electronAPI.updater.downloadUpdate()}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
        >
          Download
        </button>
      </div>
    );
  }

  if (status.state === 'downloading') {
    return (
      <div className="bg-info/90 text-white px-4 py-2 flex items-center gap-3 text-sm">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span>Downloading update... {status.percent?.toFixed(0)}%</span>
      </div>
    );
  }

  if (status.state === 'downloaded') {
    return (
      <div className="bg-success/90 text-white px-4 py-2 flex items-center justify-between text-sm">
        <span>Update ready! Restart to install v{status.version}</span>
        <button
          onClick={() => window.electronAPI.updater.installUpdate()}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
        >
          Restart Now
        </button>
      </div>
    );
  }

  if (status.state === 'error') {
    return (
      <div className="bg-error/90 text-white px-4 py-2 text-sm">
        Update error: {status.error}
      </div>
    );
  }

  return null;
}

function AppContent() {
  const [permStatus, setPermStatus] = useState<PermissionsStatus | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    window.electronAPI.permissions.getStatus().then(setPermStatus);

    // Listen for update status changes
    const unsubscribe = window.electronAPI.updater.onUpdateStatus(setUpdateStatus);
    return () => unsubscribe();
  }, []);

  // Loading while checking permissions
  if (!permStatus) {
    return (
      <div className="flex h-screen bg-background-dark items-center justify-center">
        <p className="text-grey-500">Loading...</p>
      </div>
    );
  }

  // macOS needs onboarding and user hasn't completed it yet
  if (permStatus.needsOnboarding && !onboardingDone) {
    return <OnboardingPage onComplete={() => setOnboardingDone(true)} />;
  }

  // Normal app
  return (
    <div className="flex flex-col h-screen bg-[#09090b] overflow-hidden">
      <UpdateBanner status={updateStatus} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/pomodoro" element={<PomodoroPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </Provider>
  );
}

export default App;
