import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';

// External native modules that Vite doesn't bundle
const externalModules = ['get-windows', 'better-sqlite3', 'electron-updater', 'electron-log'];

const config: ForgeConfig = {
  hooks: {
    // Workaround for Electron Forge Vite plugin bug #3738
    // External modules aren't copied to the package, so we reinstall them
    packageAfterPrune: async (_config, buildPath, _electronVersion, platform, arch) => {
      const { execSync } = await import('child_process');
      const path = await import('path');
      const electronModulePath = path.join(process.cwd(), 'node_modules', 'electron');
      const modulesToInstall = externalModules.join(' ');

      console.log(`Installing external modules: ${modulesToInstall}`);
      execSync(`npm install --omit=dev ${modulesToInstall}`, {
        cwd: buildPath,
        stdio: 'inherit',
      });

      // Rebuild native modules for Electron
      console.log('Rebuilding native modules for Electron...');
      execSync(`npx electron-rebuild -f -m "${buildPath}" --arch=${arch}`, {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: {
          ...process.env,
          ELECTRON_PATH: electronModulePath,
        },
      });
    },
  },
  packagerConfig: {
    appBundleId: 'com.activity-tracker.app',
    icon: './src/assets/icon',
    osxSign: {
      identity: 'ActivityTracker',
    },
    asar: {
      unpack: '**/*.node',
    },
    extraResource: [
      './src/assets/trayIconTemplate.png',
      './src/assets/trayIconTemplate@2x.png',
      './src/assets/icon.png',
    ],
    extendInfo: {
      NSScreenCaptureUsageDescription:
        'Activity Tracker needs Screen Recording permission to track which applications and windows you are using.',
      NSAppleEventsUsageDescription:
        'Activity Tracker needs Accessibility permission to detect active windows and track your activity.',
    },
  },
  rebuildConfig: {
    force: true,
  },
  makers: [
    new MakerSquirrel({
      setupIcon: './src/assets/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/Yosef-Adel/activity-tracker/main/src/assets/icon.ico',
      name: 'ActivityTracker',
      title: 'Activity Tracker',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
  ],
};

export default config;
