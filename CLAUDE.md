# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Activity Tracker is an Electron desktop application with a React UI, built using Vite and TypeScript.

## Commands

- **Development**: `npm start` - Starts Vite dev server with Electron and opens DevTools
- **Lint**: `npm run lint` - ESLint for TypeScript files
- **Package**: `npm run package` - Creates distributable without installers
- **Build installers**: `npm run make` - Creates platform-specific installers (Squirrel/Windows, ZIP/macOS, RPM+Deb/Linux)

## Architecture

The app follows Electron's three-process model:

1. **Main Process** (`src/main.ts`): App lifecycle, window management, OS integration
2. **Preload Process** (`src/preload.ts`): IPC bridge between main and renderer (currently minimal, expand here for secure API exposure)
3. **Renderer Process** (`src/renderer.tsx`, `src/App.tsx`): React UI layer

### React Structure

- `src/components/` - Reusable UI components (Button, Card, etc.)
- `src/sections/` - Layout sections (Header, Sidebar, etc.)
- `src/pages/` - Page-level components (HomePage, etc.)

Each folder has an `index.ts` barrel export for clean imports.

### Styling

Uses Tailwind CSS with a custom theme defined in `tailwind.config.js`. Key custom colors:
- `primary`, `secondary`, `info`, `success`, `warning`, `error`, `purple`, `destructive` - each with `lighter`, `light`, DEFAULT, `dark`, `darker`, `contrast` variants
- `background` - `dark`, `card`, `card-blue`, `card-green`, `card-brown`, `muted`, `accent`
- `grey` - 50-900 scale

### Build Configuration

- `forge.config.ts` - Electron Forge configuration for packaging and security fuses
- `vite.main.config.mts` - Main process bundling
- `vite.renderer.config.mts` - React app bundling (includes React plugin)
- `vite.preload.config.mts` - Preload script bundling

### Key Patterns

- In development, the renderer loads from Vite dev server (`MAIN_WINDOW_VITE_DEV_SERVER_URL`)
- In production, it loads from compiled files (`MAIN_WINDOW_VITE_NAME`)
- IPC communication should be added via the preload script using `contextBridge.exposeInMainWorld()`
