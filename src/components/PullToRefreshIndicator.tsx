import { Loader2, ArrowDown } from "lucide-react";

export function PullToRefreshIndicator({
  pull,
  refreshing,
  threshold,
}: {
  pull: number;
  refreshing: boolean;
  threshold: number;
}) {
  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= threshold;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${Math.min(pull, threshold) - 8}px)` }}
    >
      <div className="bg-card border border-border shadow-soft rounded-full p-2.5">
        {refreshing ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <ArrowDown
            className={`w-5 h-5 transition-transform ${ready ? "rotate-180 text-primary" : "text-muted-foreground"}`}
          />
        )}
      </div>
    </div>
  );
}
