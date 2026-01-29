import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const nativeModules = [
  'get-windows',
  'better-sqlite3',
  'bindings',
  'file-uri-to-path',
  'node-addon-api',
];

const config: ForgeConfig = {
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      const path = await import('path');
      const fs = await import('fs/promises');
      const nodeModulesSrc = path.join(process.cwd(), 'node_modules');
      const nodeModulesDest = path.join(buildPath, 'node_modules');

      await fs.mkdir(nodeModulesDest, { recursive: true });

      for (const mod of nativeModules) {
        const src = path.join(nodeModulesSrc, mod);
        const dest = path.join(nodeModulesDest, mod);
        try {
          await fs.cp(src, dest, { recursive: true });
        } catch (e) {
          console.warn(`Could not copy ${mod}:`, e);
        }
      }
    },
  },
  packagerConfig: {
    appBundleId: 'com.activity-tracker.app',
    asar: false,
    extendInfo: {
      NSScreenCaptureUsageDescription:
        'Activity Tracker needs Screen Recording permission to track which applications and windows you are using.',
      NSAppleEventsUsageDescription:
        'Activity Tracker needs Accessibility permission to detect active windows and track your activity.',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
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
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
