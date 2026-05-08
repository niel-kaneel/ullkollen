// Lättviktigt haptiskt feedback-bibliotek. Använder Vibration API.
// Tyst no-op på desktop / saknad support.

type Pattern = "tap" | "success" | "warning" | "error" | "select";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 10,
  select: 5,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [30, 80, 30, 80, 30],
};

export function haptic(pattern: Pattern = "tap") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    // ignore
  }
}
