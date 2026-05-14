import { lazy, Suspense, useEffect, useState } from "react";
export type { RoutePoint } from "./RouteMap.impl";
import type { RoutePoint } from "./RouteMap.impl";

const Inner = lazy(() => import("./RouteMap.impl").then((m) => ({ default: m.RouteMap })));

const Fallback = () => <div className="h-[420px] rounded-2xl bg-muted animate-pulse" />;

export function RouteMap(props: { points: RoutePoint[]; polyline: [number, number][] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Fallback />;
  return (
    <Suspense fallback={<Fallback />}>
      <Inner {...props} />
    </Suspense>
  );
}
