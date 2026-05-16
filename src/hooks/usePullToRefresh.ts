import { useEffect, useRef, useState } from "react";

type Options = {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  enabled?: boolean;
};

/**
 * Native-känsla pull-to-refresh för mobil. Triggar onRefresh när användaren
 * drar ned från toppen av sidan ~70 px och släpper. Tyst no-op på desktop.
 */
export function usePullToRefresh({ onRefresh, threshold = 70, enabled = true }: Options) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshing) {
        tracking.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        // resistans
        const damped = Math.min(120, Math.pow(dy, 0.85));
        setPull(damped);
      } else {
        setPull(0);
      }
    };

    const onTouchEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      startY.current = null;
      if (pull >= threshold && !refreshing) {
        setRefreshing(true);
        setPull(threshold);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, onRefresh, pull, threshold, refreshing]);

  return { pull, refreshing, threshold };
}
