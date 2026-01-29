import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.activity-tracker.app',
    asar: {
      unpack: '**/{better-sqlite3,get-windows,@mapbox,bindings,file-uri-to-path,node-addon-api,detect-libc,make-dir,nopt,npmlog,rimraf,semver,tar,minipass,minizlib,mkdirp,fs-minipass,chownr,yallist,abbrev,are-we-there-yet,console-control-strings,delegates,gauge,has-unicode,set-blocking,wide-align,string-width,strip-ansi,ansi-regex,emoji-regex,is-fullwidth-code-point,aproba,color-support,signal-exit,glob,inflight,inherits,once,wrappy,path-is-absolute,brace-expansion,balanced-match,concat-map}/**/*',
    },
    extendInfo: {
      NSScreenCaptureUsageDescription:
        'Activity Tracker needs Screen Recording permission to track which applications and windows you are using.',
      NSAppleEventsUsageDescription:
        'Activity Tracker needs Accessibility permission to detect active windows and track your activity.',
    },
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      const path = await import('path');
      const fs = await import('fs/promises');
      const nodeModulesSrc = path.join(process.cwd(), 'node_modules');
      const nodeModulesDest = path.join(buildPath, 'node_modules');

      const modulesToCopy = [
        'get-windows',
        'better-sqlite3',
        '@mapbox',
        'bindings',
        'file-uri-to-path',
        'node-addon-api',
        'detect-libc',
        'make-dir',
        'nopt',
        'npmlog',
        'rimraf',
        'semver',
        'tar',
        'minipass',
        'minizlib',
        'mkdirp',
        'fs-minipass',
        'chownr',
        'yallist',
        'abbrev',
        'are-we-there-yet',
        'console-control-strings',
        'delegates',
        'gauge',
        'has-unicode',
        'set-blocking',
        'wide-align',
        'string-width',
        'strip-ansi',
        'ansi-regex',
        'emoji-regex',
        'is-fullwidth-code-point',
        'aproba',
        'color-support',
        'signal-exit',
        'glob',
        'inflight',
        'inherits',
        'once',
        'wrappy',
        'path-is-absolute',
        'brace-expansion',
        'balanced-match',
        'concat-map',
      ];

      await fs.mkdir(nodeModulesDest, { recursive: true });

      for (const mod of modulesToCopy) {
        const src = path.join(nodeModulesSrc, mod);
        const dest = path.join(nodeModulesDest, mod);
        await fs.cp(src, dest, { recursive: true });
      }
    },
  },
  rebuildConfig: {
    onlyModules: ['better-sqlite3'],
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
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
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
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
