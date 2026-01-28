import { Provider } from 'react-redux';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { Sidebar } from './sections';
import { HomePage, ActivitiesPage, ReportsPage, SettingsPage } from './pages';

function App() {
  return (
    <Provider store={store}>
      <HashRouter>
        <div className="flex min-h-screen bg-background-dark">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/activities" element={<ActivitiesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </Provider>
  );
}

export default App;
