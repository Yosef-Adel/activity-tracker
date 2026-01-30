import { crashReporter, app } from "electron";
import log from "electron-log";
import path from "path";

export function initLogger() {
  // Configure electron-log
  log.transports.file.resolvePathFn = () =>
    path.join(app.getPath("userData"), "logs", "main.log");
  log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB max
  log.transports.file.format =
    "{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}";

  log.transports.console.level = "debug";
  log.transports.file.level = "info";

  // Catch unhandled errors
  log.errorHandler.startCatching();

  // Initialize Electron's crash reporter (local only, no remote submission)
  crashReporter.start({
    productName: "Activity Tracker",
    submitURL: "",
    uploadToServer: false,
  });

  log.info(`App starting. Version: ${app.getVersion()}`);
  log.info(`Platform: ${process.platform} ${process.arch}`);
  log.info(`Electron: ${process.versions.electron}`);
  log.info(`Crash dumps: ${app.getPath("crashDumps")}`);
}

export { log };
