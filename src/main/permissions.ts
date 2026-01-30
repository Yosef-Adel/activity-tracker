import { systemPreferences, shell } from "electron";

export interface PermissionsStatus {
  platform: "darwin" | "other";
  accessibility: boolean;
  screenRecording: boolean;
  needsOnboarding: boolean;
}

export function getPermissionsStatus(): PermissionsStatus {
  if (process.platform !== "darwin") {
    return {
      platform: "other",
      accessibility: true,
      screenRecording: true,
      needsOnboarding: false,
    };
  }

  const accessibility =
    systemPreferences.isTrustedAccessibilityClient(false);
  const screenRecording =
    systemPreferences.getMediaAccessStatus("screen") === "granted";

  return {
    platform: "darwin",
    accessibility,
    screenRecording,
    needsOnboarding: !accessibility,
  };
}

export function requestAccessibility(): boolean {
  return systemPreferences.isTrustedAccessibilityClient(true);
}

export function openScreenRecordingPrefs(): void {
  shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
  );
}
