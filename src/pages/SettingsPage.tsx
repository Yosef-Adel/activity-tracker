import { Card } from "../components";

const CATEGORY_CONFIG = [
  { name: "Development", color: "#8b5cf6", type: "Productive", apps: ["VS Code", "WebStorm", "Xcode", "Terminal"] },
  { name: "Productivity", color: "#a855f7", type: "Productive", apps: ["Notion", "Obsidian", "Notes"] },
  { name: "Research", color: "#0ea5e9", type: "Productive", apps: ["Safari", "Chrome (docs)"] },
  { name: "Design", color: "#f97316", type: "Productive", apps: ["Figma", "Sketch"] },
  { name: "Communication", color: "#22c55e", type: "Neutral", apps: ["Slack", "Discord", "Teams"] },
  { name: "Email", color: "#ec4899", type: "Neutral", apps: ["Mail", "Gmail"] },
  { name: "Entertainment", color: "#ef4444", type: "Distracting", apps: ["YouTube", "Netflix", "Spotify"] },
  { name: "Social", color: "#eab308", type: "Distracting", apps: ["Twitter", "Facebook", "Instagram"] },
];

function ComingSoonOverlay() {
  return (
    <div className="absolute inset-0 bg-[#09090b]/80 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10">
      <div className="text-center">
        <span className="px-3 py-1.5 bg-primary/20 text-primary text-xs font-medium rounded-full">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

export function SettingsPage() {

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* General Settings - Coming Soon */}
        <Card className="relative">
          <ComingSoonOverlay />
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">General</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Enable Tracking</p>
                <p className="text-xs text-grey-500">Automatically track your activities</p>
              </div>
              <button className="relative w-11 h-6 rounded-full bg-primary">
                <div className="absolute top-1 left-6 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Idle Timeout</p>
                <p className="text-xs text-grey-500">Minutes before pausing</p>
              </div>
              <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
                <option value={2}>2 minutes</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Launch at Startup</p>
                <p className="text-xs text-grey-500">Start when you log in</p>
              </div>
              <button className="relative w-11 h-6 rounded-full bg-grey-700">
                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
          </div>
        </Card>

        {/* Work Hours - Coming Soon */}
        <Card className="relative">
          <ComingSoonOverlay />
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Work Hours</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Daily Goal</p>
                <p className="text-xs text-grey-500">Target hours per day</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-lg bg-white/5 text-grey-400 flex items-center justify-center">
                  -
                </button>
                <span className="text-white font-medium w-12 text-center">8h</span>
                <button className="w-8 h-8 rounded-lg bg-white/5 text-grey-400 flex items-center justify-center">
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Work Schedule</p>
                <p className="text-xs text-grey-500">Your typical hours</p>
              </div>
              <span className="text-sm text-grey-500">8:00 - 18:00</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Work Days</p>
                <p className="text-xs text-grey-500">Days to track</p>
              </div>
              <span className="text-sm text-grey-500">Mon - Fri</span>
            </div>
          </div>
        </Card>

        {/* Notifications - Coming Soon */}
        <Card className="relative">
          <ComingSoonOverlay />
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Notifications</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Show Notifications</p>
                <p className="text-xs text-grey-500">Daily summaries & alerts</p>
              </div>
              <button className="relative w-11 h-6 rounded-full bg-primary">
                <div className="absolute top-1 left-6 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Break Reminders</p>
                <p className="text-xs text-grey-500">Remind to take breaks</p>
              </div>
              <button className="relative w-11 h-6 rounded-full bg-primary">
                <div className="absolute top-1 left-6 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Break Interval</p>
                <p className="text-xs text-grey-500">Time between breaks</p>
              </div>
              <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
                <option value={60}>1 hour</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Categories - Coming Soon */}
        <Card className="lg:col-span-2 xl:col-span-2 relative">
          <ComingSoonOverlay />
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Categories</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            {CATEGORY_CONFIG.map((category) => (
              <div
                key={category.name}
                className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <div>
                    <span className="text-sm text-white">{category.name}</span>
                    <p className="text-[10px] text-grey-600">{category.apps.join(", ")}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    category.type === "Productive"
                      ? "text-success bg-success/10"
                      : category.type === "Distracting"
                      ? "text-error bg-error/10"
                      : "text-grey-400 bg-white/5"
                  }`}
                >
                  {category.type}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Data Management - Coming Soon */}
        <Card className="relative">
          <ComingSoonOverlay />
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Data</p>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between py-3 text-left rounded-lg px-2 -mx-2">
              <div>
                <p className="text-sm font-medium text-white">Export Data</p>
                <p className="text-xs text-grey-500">Download as CSV</p>
              </div>
              <svg className="w-5 h-5 text-grey-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>

            <button className="w-full flex items-center justify-between py-3 text-left rounded-lg px-2 -mx-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Import Data</p>
                <p className="text-xs text-grey-500">Restore from backup</p>
              </div>
              <svg className="w-5 h-5 text-grey-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </button>

            <button className="w-full flex items-center justify-between py-3 text-left rounded-lg px-2 -mx-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-error">Clear All Data</p>
                <p className="text-xs text-grey-500">Delete everything</p>
              </div>
              <svg className="w-5 h-5 text-grey-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </Card>

        {/* Privacy - Coming Soon */}
        <Card className="relative">
          <ComingSoonOverlay />
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">Privacy</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Local Storage Only</p>
                <p className="text-xs text-grey-500">Data never leaves device</p>
              </div>
              <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">Active</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Excluded Apps</p>
                <p className="text-xs text-grey-500">Apps not tracked</p>
              </div>
              <span className="text-sm text-grey-400">0 apps</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
              <div>
                <p className="text-sm font-medium text-white">Blur Sensitive</p>
                <p className="text-xs text-grey-500">Hide banking, etc.</p>
              </div>
              <button className="relative w-11 h-6 rounded-full bg-grey-700">
                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-4">About</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-grey-500">Version</span>
              <span className="text-white">1.0.0-beta</span>
            </div>
            <div className="flex justify-between py-1 border-t border-white/[0.06]">
              <span className="text-grey-500">Platform</span>
              <span className="text-white">{navigator.platform}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-white/[0.06]">
              <span className="text-grey-500">Electron</span>
              <span className="text-white">28.0.0</span>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-xs text-grey-500">Settings persistence coming in future updates.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
