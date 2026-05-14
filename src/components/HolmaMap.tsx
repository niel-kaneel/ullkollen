import { lazy, Suspense, useEffect, useState } from "react";
export type { StationPoint, OwnerPoint, PickupPoint } from "./HolmaMap.impl";
import type { StationPoint, OwnerPoint, PickupPoint } from "./HolmaMap.impl";

const Inner = lazy(() => import("./HolmaMap.impl").then((m) => ({ default: m.HolmaMap })));

const Fallback = () => (
  <div className="h-[480px] rounded-2xl bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
    Laddar karta…
  </div>
);

export function HolmaMap(props: { stations: StationPoint[]; owners: OwnerPoint[]; pickups: PickupPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Fallback />;
  return (
    <Suspense fallback={<Fallback />}>
      <Inner {...props} />
    </Suspense>
  );
}
