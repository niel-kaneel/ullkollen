import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Route as RouteIcon, MapPin, Truck, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { RouteMap, type RoutePoint } from "@/components/RouteMap";
import { planRoute, haversineKm, type Stop } from "@/lib/route-planner";
import { toast } from "sonner";

export const Route = createFileRoute("/app/route-planner")({
  component: RoutePlanner,
});

type Pickup = {
  id: string;
  owner_id: string | null;
  station_id: string | null;
  requested_kg: number;
  priority: string;
  status: string;
  scheduled_for: string | null;
  notes: string | null;
};

type Station = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  current_stock_kg: number;
  capacity_kg: number;
};

type Profile = {
  id: string;
  full_name: string | null;
  farm_name: string | null;
  home_lat: number | null;
  home_lng: number | null;
};

type Shearer = {
  id: string;
  display_name: string;
  home_lat: number | null;
  home_lng: number | null;
  has_trailer: boolean;
  mileage_rate_with_trailer_sek: number;
  mileage_rate_without_trailer_sek: number;
};

function RoutePlanner() {
  const { user, isAdmin, loading } = useAuth();
  const [shearer, setShearer] = useState<Shearer | null>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destStationId, setDestStationId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string>(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );

  const load = async () => {
    if (!user) return;
    const [{ data: shearerRow }, { data: pickupRows }, { data: stationRows }] = await Promise.all([
      supabase
        .from("shearers")
        .select("id, display_name, home_lat, home_lng, has_trailer, mileage_rate_with_trailer_sek, mileage_rate_without_trailer_sek")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("pickup_requests")
        .select("id, owner_id, station_id, requested_kg, priority, status, scheduled_for, notes")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("collection_stations")
        .select("id, name, lat, lng, current_stock_kg, capacity_kg")
        .eq("approved", true)
        .eq("active", true),
    ]);

    setShearer((shearerRow as Shearer) ?? null);
    setPickups((pickupRows as Pickup[]) ?? []);
    setStations(((stationRows as Station[]) ?? []).filter((s) => s.lat != null && s.lng != null));

    const ownerIds = Array.from(
      new Set(((pickupRows as Pickup[]) ?? []).map((p) => p.owner_id).filter((x): x is string => !!x)),
    );
    if (ownerIds.length > 0) {
      const { data: profRows } = await supabase
        .from("profiles")
        .select("id, full_name, farm_name, home_lat, home_lng")
        .in("id", ownerIds);
      setProfiles(new Map((profRows ?? []).map((p) => [p.id, p as Profile])));
    } else {
      setProfiles(new Map());
    }
  };

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user]);

  // Resolve a pickup to a coordinate (station or owner home)
  const pickupCoord = (p: Pickup): { lat: number; lng: number; label: string } | null => {
    if (p.station_id) {
      const s = stations.find((st) => st.id === p.station_id);
      if (s?.lat != null && s.lng != null) return { lat: s.lat, lng: s.lng, label: s.name };
    }
    if (p.owner_id) {
      const prof = profiles.get(p.owner_id);
      if (prof?.home_lat != null && prof?.home_lng != null) {
        return { lat: prof.home_lat, lng: prof.home_lng, label: prof.farm_name || prof.full_name || "Fårägare" };
      }
    }
    return null;
  };

  const pickupsWithCoords = useMemo(
    () => pickups.map((p) => ({ pickup: p, coord: pickupCoord(p) })).filter((x) => x.coord !== null),
    [pickups, stations, profiles],
  );

  const selectedStops: Stop[] = useMemo(() => {
    return pickupsWithCoords
      .filter((x) => selected.has(x.pickup.id))
      .map((x) => ({
        id: x.pickup.id,
        lat: x.coord!.lat,
        lng: x.coord!.lng,
        label: x.coord!.label,
        kg: Number(x.pickup.requested_kg),
      }));
  }, [pickupsWithCoords, selected]);

  const startPoint: Stop | null = useMemo(() => {
    if (shearer?.home_lat != null && shearer?.home_lng != null) {
      return { id: "start", lat: shearer.home_lat, lng: shearer.home_lng, label: "Start (du)" };
    }
    return null;
  }, [shearer]);

  const destStation = stations.find((s) => s.id === destStationId);
  const endPoint: Stop | null = destStation && destStation.lat != null && destStation.lng != null
    ? { id: "end", lat: destStation.lat, lng: destStation.lng, label: destStation.name }
    : null;

  const plan = useMemo(() => {
    if (!startPoint || !endPoint || selectedStops.length === 0) return null;
    return planRoute(startPoint, selectedStops, endPoint);
  }, [startPoint, endPoint, selectedStops]);

  const totalKg = selectedStops.reduce((sum, s) => sum + (s.kg ?? 0), 0);
  const mileageRate = shearer
    ? Number(shearer.has_trailer ? shearer.mileage_rate_with_trailer_sek : shearer.mileage_rate_without_trailer_sek)
    : 0;
  const estMileageSek = plan ? Math.round(plan.totalKm * mileageRate) : 0;

  const mapPoints: RoutePoint[] = useMemo(() => {
    const pts: RoutePoint[] = [];
    if (startPoint) pts.push({ id: "start", lat: startPoint.lat, lng: startPoint.lng, label: startPoint.label, kind: "start" });
    if (plan) {
      plan.ordered.forEach((s, i) =>
        pts.push({ id: s.id, lat: s.lat, lng: s.lng, label: `${s.label} (${s.kg ?? 0} kg)`, kind: "pickup", order: i + 1 }),
      );
    } else {
      // Show selected stops as unordered when no plan
      selectedStops.forEach((s) =>
        pts.push({ id: s.id, lat: s.lat, lng: s.lng, label: s.label, kind: "pickup" }),
      );
    }
    if (endPoint) pts.push({ id: "end", lat: endPoint.lat, lng: endPoint.lng, label: endPoint.label, kind: "station" });
    return pts;
  }, [startPoint, endPoint, plan, selectedStops]);

  const polyline: [number, number][] = useMemo(() => {
    if (!plan || !startPoint || !endPoint) return [];
    return [
      [startPoint.lat, startPoint.lng],
      ...plan.ordered.map((s) => [s.lat, s.lng] as [number, number]),
      [endPoint.lat, endPoint.lng],
    ];
  }, [plan, startPoint, endPoint]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const saveRoute = async () => {
    if (!plan || selected.size === 0 || !destStation) return;
    setSaving(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("pickup_requests")
      .update({
        status: "scheduled",
        scheduled_for: scheduledFor,
        notes: `Planerad rutt → ${destStation.name} (${plan.totalKm.toFixed(1)} km, ~${estMileageSek} SEK)${shearer ? ` av ${shearer.display_name}` : ""}`,
      })
      .in("id", ids);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} hämtning(ar) schemalagda`);
    setSelected(new Set());
    load();
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Laddar…</div>;
  if (!user) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Logga in för att planera rutter. <Link to="/auth" className="underline">Logga in</Link>
      </div>
    );
  }
  if (!shearer && !isAdmin) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader title="Ruttplanering" back="/app" />
        <div className="p-4 max-w-md mx-auto">
          <p className="text-sm text-muted-foreground">
            Endast klippare/insamlare och administratörer kan planera rutter.{" "}
            <Link to="/app/shearer-hub" className="underline">Gå till klipparhubben</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Ruttplanering" subtitle="Optimera hämtningar längs en rutt" back="/app" />

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {!startPoint && (
          <div className="bg-accent/15 border border-accent/40 rounded-2xl p-3 text-sm">
            Sätt din startposition i <Link to="/app/profile" className="underline">profilen</Link> (hemadress med koordinater) för att aktivera ruttoptimering.
          </div>
        )}

        {/* Destination & date */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Slutdestination (insamlingsstation)</Label>
              <select
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={destStationId}
                onChange={(e) => setDestStationId(e.target.value)}
              >
                <option value="">Välj station…</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.current_stock_kg}/{s.capacity_kg} kg)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Planerat datum</Label>
              <input
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Pickup list */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="w-4 h-4" /> Tillgängliga hämtningar ({pickupsWithCoords.length})
          </h3>
          {pickupsWithCoords.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga väntande hämtningar med koordinater.</p>
          ) : (
            <ul className="space-y-1.5">
              {pickupsWithCoords.map(({ pickup, coord }) => {
                const dist = startPoint ? haversineKm(startPoint, coord!).toFixed(1) : "?";
                return (
                  <li key={pickup.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                    <Checkbox
                      checked={selected.has(pickup.id)}
                      onCheckedChange={() => toggle(pickup.id)}
                      id={`p-${pickup.id}`}
                    />
                    <label htmlFor={`p-${pickup.id}`} className="flex-1 cursor-pointer min-w-0">
                      <div className="text-sm font-medium truncate">
                        {coord!.label} · {pickup.requested_kg} kg
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pickup.priority} · {dist} km från dig
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Plan summary */}
        {plan && (
          <div className="bg-primary/5 border border-primary/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Föreslagen rutt</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-xs text-muted-foreground">Sträcka</div><div className="text-lg font-bold">{plan.totalKm.toFixed(1)} km</div></div>
              <div><div className="text-xs text-muted-foreground">Total ull</div><div className="text-lg font-bold">{totalKg} kg</div></div>
              <div><div className="text-xs text-muted-foreground">Milkostnad</div><div className="text-lg font-bold">~{estMileageSek} kr</div></div>
            </div>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5 pt-2 border-t border-border/50">
              <li>Start: {startPoint?.label}</li>
              {plan.ordered.map((s, i) => (<li key={s.id}>{s.label} ({s.kg} kg)</li>))}
              <li>Slut: {endPoint?.label}</li>
            </ol>
            <Button onClick={saveRoute} disabled={saving} className="w-full mt-2">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Schemalägg rutt
            </Button>
          </div>
        )}

        {(plan || selectedStops.length > 0) && (
          <RouteMap points={mapPoints} polyline={polyline} />
        )}
      </div>
    </div>
  );
}
