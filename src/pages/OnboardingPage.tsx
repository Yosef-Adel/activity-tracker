import { useEffect, useState } from "react";
import { Card, Button } from "../components";
import type { PermissionsStatus } from "../types/electron";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

interface OnboardingPageProps {
  onComplete: () => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [status, setStatus] = useState<PermissionsStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const fetchStatus = async () => {
    const s = await window.electronAPI.permissions.getStatus();
    setStatus(s);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRequestAccessibility = async () => {
    setIsChecking(true);
    await window.electronAPI.permissions.requestAccessibility();
    // macOS needs a moment to update permission status
    setTimeout(async () => {
      await fetchStatus();
      setIsChecking(false);
    }, 1000);
  };

  const handleOpenScreenRecording = async () => {
    await window.electronAPI.permissions.openScreenRecordingPrefs();
  };

  const handleRecheck = async () => {
    setIsChecking(true);
    await fetchStatus();
    setIsChecking(false);
  };

  const handleContinue = async () => {
    await window.electronAPI.permissions.startTracker();
    onComplete();
  };

  const accessibilityGranted = status?.accessibility ?? false;
  const screenRecordingGranted = status?.screenRecording ?? false;
  const canContinue = accessibilityGranted;

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-white">
            Welcome to Activity Tracker
          </h1>
          <p className="text-lg text-grey-400">
            A couple of macOS permissions are needed to track your activities.
          </p>
        </div>

        {/* Permission Cards */}
        <div className="space-y-4">
          {/* Accessibility */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/20">
                {accessibilityGranted ? (
                  <CheckIcon className="w-5 h-5 text-success" />
                ) : (
                  <span className="text-primary font-bold">1</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Accessibility
                  <span className="ml-2 text-xs font-normal text-error">
                    Required
                  </span>
                </h3>
                <p className="text-sm text-grey-400 mb-4">
                  Allows reading which apps and windows you're using. Without
                  this, the tracker cannot function.
                </p>
                {accessibilityGranted ? (
                  <div className="flex items-center gap-2 text-success">
                    <CheckIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Permission granted
                    </span>
                  </div>
                ) : (
                  <Button
                    onClick={handleRequestAccessibility}
                    disabled={isChecking}
                  >
                    {isChecking ? "Checking..." : "Grant Permission"}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Screen Recording */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-grey-800">
                {screenRecordingGranted ? (
                  <CheckIcon className="w-5 h-5 text-success" />
                ) : (
                  <span className="text-grey-400 font-bold">2</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Screen Recording
                  <span className="ml-2 text-xs font-normal text-grey-500">
                    Optional
                  </span>
                </h3>
                <p className="text-sm text-grey-400 mb-4">
                  Enables tracking website URLs in browsers. Without it, apps
                  and window titles are still tracked but website URLs won't be
                  captured.
                </p>
                {screenRecordingGranted ? (
                  <div className="flex items-center gap-2 text-success">
                    <CheckIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Permission granted
                    </span>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={handleOpenScreenRecording}>
                    Open System Preferences
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Recheck + Continue */}
        <div className="flex flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!canContinue}
            className={!canContinue ? "opacity-50 cursor-not-allowed" : ""}
          >
            Continue to App
          </Button>
          {!canContinue && (
            <p className="text-sm text-grey-500">
              Accessibility permission is required to continue
            </p>
          )}
          <button
            onClick={handleRecheck}
            disabled={isChecking}
            className="text-sm text-grey-500 hover:text-grey-300 transition-colors"
          >
            {isChecking ? "Checking..." : "Recheck permissions"}
          </button>
        </div>

        {/* Help text */}
        <div className="text-center text-xs text-grey-600">
          <p>
            You can manage these in System Settings &gt; Privacy &amp; Security
          </p>
        </div>
      </div>
    </div>
  );
}
