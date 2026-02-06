import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { Sidebar } from './sections';
import { HomePage, ActivitiesPage, PomodoroPage, ReportsPage, CalendarPage, SettingsPage, OnboardingPage } from './pages';
import type { PermissionsStatus } from './types/electron';

function AppContent() {
  const [permStatus, setPermStatus] = useState<PermissionsStatus | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    window.electronAPI.permissions.getStatus().then(setPermStatus);
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
    <div className="flex h-screen bg-[#09090b] overflow-hidden">
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
