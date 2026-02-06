# Activity Tracker - TODO

## Completed

- [x] Idle detection (pauses after 2 min inactivity)
- [x] Session grouping (consecutive same-app activities grouped)
- [x] Basic categorization (development, social, entertainment, etc.)
- [x] Dashboard with stats
- [x] Reports page with breakdowns
- [x] Activities page with expandable sessions
- [x] GitHub Actions CI/CD (builds for Windows, macOS, Linux)
- [x] Pause/resume tracking toggle
- [x] Exclude apps from tracking (self-tracking excluded)
- [x] System tray (minimize to tray, context menu, activity tooltip)
- [x] VS Code workspace detection (macOS em-dash title parsing)
- [x] Parse terminal title for project context
- [x] Custom app icon
- [x] Websites section on dashboard
- [x] Session-grouped activity feed on dashboard
- [x] Database seed script for testing
- [x] v1.0.0 release
- [x] DB-driven categories with FK relations (categories + category_rules tables)
- [x] Category CRUD API (create, update, delete categories; add/remove rules)
- [x] IPC handlers + preload bridge for category management
- [x] Unit tests for categorizer (99 tests via vitest)
- [x] Improved categorization: priority-based category ordering
- [x] Improved categorization: match modes (exact, contains, regex) per rule
- [x] Improved categorization: URL hostname parsing for domain matching
- [x] Improved categorization: pre-compiled regex patterns
- [x] Improved categorization: compound domain+keyword rules (YouTube ambiguity solved)
- [x] Auto-updater (electron-updater with GitHub Releases, user-controlled download)
- [x] Crash reporting (electron-log file logging + Electron crashReporter, local only)
- [x] macOS permissions onboarding (Accessibility required, Screen Recording optional, guided setup)
- [x] Auto-updater (Electron autoUpdater with GitHub Releases)
- [x] Crash reporting
- [x] First-run screen explaining what the app does
- [x] macOS permission check (Screen Recording, Accessibility) with guided setup
- [x] Show clear error state when permissions are missing instead of silent failure
- [x] Scoring-based categorization (replaces first-match-wins, weighted layers, confidence threshold)
- [x] Flow state detection (majority-based boost from recent activity history)
- [x] DB-driven file_path rules for categorization
- [x] Recategorize UI (pencil icon on sessions, modal with category picker + auto-generated rules)
- [x] Recategorize applies to ALL matching sessions (not just the clicked one)
- [x] Category management UI in Settings (create, edit, delete categories + manage rules)
- [x] Lock screen / screensaver detection as idle (loginwindow, ScreenSaverEngine)
- [x] Exclude system apps from tracking (Dock, SystemUIServer, Control Center, etc.)
- [x] Minimum duration threshold (sub-30s activities absorbed into previous entry)
- [x] Session merging (same-category sessions with <2 min gap merge into one block)
- [x] User-managed projects (create/edit/delete in Settings, assign sessions in Activities)
- [x] Project auto-suggestion (VS Code/GitHub auto-detected names pre-select matching project)
- [x] Projects dashboard card (shows time per user-created project with colors)
- [x] YouTube Shorts insight card on dashboard
- [x] Delete individual activities (inline confirm on activity rows)
- [x] Delete sessions (inline confirm on session rows)
- [x] Manual time entries (modal with activity name, category, time range, notes)
- [x] Manual entries displayed in timeline with "Manual" badge
- [x] Pomodoro timer page (work/break modes, custom duration, label input)
- [x] Pomodoro integrates with activity records (tags activities during pomodoro)
- [x] Pomodoro history with expandable activity list
- [x] Delete pomodoros (inline confirm on history rows)
- [x] User-configurable app exclusion list (Settings > Privacy, DB-backed, hot-reload)
- [x] Windows Taskbar excluded from tracking (distinguishes Taskbar from File Explorer)
- [x] Launch at startup toggle (Settings > General, uses Electron login item API)
- [x] Configurable idle timeout (Settings > General, 1-30 min, DB-persisted)

---

## Infrastructure & Polish — Ongoing

### ✅ Completed Recently

- [x] Configure idle timeout (Settings > General, persisted in DB)
- [x] Configure tracking interval (Settings > General, 2-30 sec)
- [x] Exclude system apps from tracking (hardcoded list + user-configurable exclusion list)
- [x] User-configurable app exclusion list (DB-backed, Settings UI, hot-reload)
- [x] Launch at system startup option
- [x] Reset/clear all data button (Settings > Data)
- [x] Empty states with helpful messages
- [x] Loading skeletons on initial data fetch
- [x] Smooth transitions when switching Day/Week views
- [x] Handle edge case: tracking across midnight (day boundary)
- [x] UI to add/edit/delete categories
- [x] UI to add/edit categorization rules (apps, domains, keywords)
- [x] Ability to recategorize existing activities
- [x] Edit activity details (fix miscategorization)
- [x] Delete individual activities
- [x] Delete sessions
- [x] Add manual time entries (meetings, offline work)
- [x] Pomodoro completion desktop notifications
- [x] Daily summary notification (end of day recap)
- [x] Goal milestone alerts (category goal completion)
- [x] Configurable notification preferences (enable/disable per type)
- [x] Break reminders (configurable interval)
- [x] Monthly calendar view with daily activity heatmap
- [x] Click a day to see detailed breakdown
- [x] Color-coded by productivity level

### 🔴 High Priority — Data & Core UX

**Data Export (users need backup capability)**
- [ ] Export data to CSV
- [ ] Export data to JSON
- [ ] Import data from CSV/JSON (backup restore)

**Better Visualizations (dashboard value)**
- [ ] Weekly heatmap (like GitHub contribution graph)
- [ ] Line charts for trends over time
- [ ] Pie/donut chart for category breakdown
- [ ] Streak tracking (consecutive productive days)

### 🟡 Medium Priority — Enhanced Features

**Better Context Detection (developer experience)**
- [ ] JetBrains IDE support (IntelliJ, WebStorm, PyCharm)
- [ ] Xcode project detection
- [ ] Better vim/neovim/tmux detection

**Keyboard Shortcuts (power users)**
- [ ] Global hotkey to pause/resume
- [ ] Global hotkey to start pomodoro
- [ ] Navigate app with keyboard

**AFK / Idle Improvements (accuracy)**
- [ ] Post-idle prompt: ask user what they were doing while away
- [ ] Let users retroactively assign idle time to a category/project
- [ ] Smarter idle merging (short idle gaps within same app don't break sessions)

**Data Retention & Cleanup (long-term users)**
- [ ] Configurable data retention policy (e.g., keep 90 days detailed, aggregate older)
- [ ] Automatic pruning of old data on schedule
- [ ] Manual "clear data older than X" option
- [ ] Database size indicator in settings

### 🟢 Lower Priority — Nice to Have

**Themes & Appearance**
- [ ] Light/dark theme toggle
- [ ] Custom accent colors
- [ ] Compact mode for smaller screens

**Browser Integration (requires extension development)**
- [ ] Browser extension for accurate URL/tab tracking
- [ ] Track specific tabs/pages not just domain

**App/Website Blocking (complex feature)**
- [ ] Block distracting apps/sites during focus sessions
- [ ] Configurable block list per category
- [ ] Soft block (warning notification) vs hard block (redirect/close)

**Platform**
- [ ] Linux Wayland support (when APIs become available)

---

## Technical Debt

- [ ] Fix drizzle.config.ts parsing error
- [ ] Add proper error handling throughout
- [ ] Add loading states to all async operations
- [x] Unit tests for categorizer (99 tests)
- [ ] Unit tests for context extractor
- [ ] E2E tests for main flows
- [ ] Performance optimization for large datasets (pagination, virtual scrolling)
- [ ] Migrate from polling to event-driven window tracking where possible
- [ ] Type-safe IPC layer (shared types between main/preload/renderer)

---

## Product Vision

The app currently does **passive observation** — it shows you what happened. The path to
something people actually keep using (and eventually pay for) is:

**Observation → Insights → Behavior Change**

Each stage below builds on the previous one. Don't skip ahead.

---

## Stage 1: Insights — v1.1

> Move from "here's your data" to "here's what your data means"

### Week-over-Week Comparisons

- [ ] Compare this week vs last week for each category
- [ ] Show deltas: "+1h 20m development" / "-45m social media"
- [ ] Highlight significant changes (>20% shift) on dashboard
- [ ] "Your most productive day this week was Tuesday" type insights

### Trend Detection

- [ ] Rolling averages for productive vs unproductive time
- [ ] Detect patterns: "You're most focused between 9-11am"
- [ ] Detect anti-patterns: "Your social media usage spikes after 3pm"
- [ ] Show productive hours vs total tracked hours ratio over time

### Weekly Digest Notification

- [ ] Desktop notification every Monday morning with last week's summary
- [ ] Total productive time, top projects, biggest time sinks
- [ ] One actionable insight (e.g., "Reddit increased 40% — set a limit?")
- [ ] Configurable: which day/time to receive it
- [ ] Optional daily end-of-day summary report

### Context-Aware Dashboard

- [ ] "Right now" card: show how today compares to your average day at this hour
- [ ] "You usually spend X on development by now, you're at Y" progress indicator
- [ ] Surface the project you've spent the most time on this week prominently

---

## Stage 2: Behavior Change — v1.2

> Move from "here's what your data means" to "here's how to act on it"

### Goals

- [ ] Set daily goals per category (e.g., "4h development", "< 30m social")
- [ ] Goal progress ring/bar on dashboard (like Apple Watch activity rings)
- [ ] Weekly goal summary: how many days you hit your targets
- [ ] Streaks: "5-day streak of hitting your development goal"

### Alerts & Limits

- [ ] Set time limits per app or category
- [ ] Desktop notification when approaching limit (80% threshold)
- [ ] Desktop notification when limit exceeded
- [ ] Optional: gentle nudge ("You've been on Twitter for 30m, take a break?")

### Focus Sessions

- [x] Pomodoro timer with named sessions and activity tagging
- [ ] During focus session, flag any non-productive app switch
- [ ] Focus session report: how much of the session was actually focused
- [ ] "Deep work" auto-detection: 45+ min uninterrupted development

### Break Reminders

- [ ] Notify after X continuous minutes of work (configurable, default 90m)
- [ ] Track break frequency and duration
- [ ] Show work/break ratio in reports
- [ ] "You've been on X for Y minutes" nudge for distracting categories

---

## Stage 3: Developer Niche — v1.3

> Lean into "time tracker built for developers" as positioning

### Project-Level Analytics

- [x] User-managed projects with manual session assignment
- [x] Auto-suggestion from VS Code/GitHub context detection
- [ ] Per-project dashboard: time breakdown by file type, language, branch
- [ ] "Time to complete" estimates based on historical project data
- [ ] Project switching frequency (context switch cost visualization)

### Git Integration

- [ ] Detect current git branch from terminal/IDE
- [ ] Correlate time spent with commits (time between commits)
- [ ] Show "coding time" vs "review time" vs "debugging time" heuristics
- [ ] Link to GitHub PRs/issues from activity context

### Code Review Time

- [ ] Track time spent on GitHub PR pages
- [ ] Aggregate: "You spent 3h on code reviews this week"
- [ ] Break down by repo

### Meeting Impact

- [ ] Detect calendar apps / video calls (Zoom, Meet, Slack huddle)
- [ ] "Meeting load" metric: % of day in meetings
- [ ] Fragmentation score: how many focus blocks were interrupted by meetings
- [ ] Show meeting-free deep work windows
