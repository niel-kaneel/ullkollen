import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, Truck, Warehouse, Package, RefreshCw, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { HolmaMap, type StationPoint, type OwnerPoint, type PickupPoint } from "@/components/HolmaMap";
import { toast } from "sonner";

export const Route = createFileRoute("/app/holma")({
  component: HolmaCentral,
});

type LotRow = {
  id: string;
  owner_id: string;
  estimated_kg: number;
  actual_kg: number | null;
  status: string;
  breed_codes: string[] | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  farm_name: string | null;
  home_lat: number | null;
  home_lng: number | null;
};

type PickupRow = {
  id: string;
  owner_id: string | null;
  station_id: string | null;
  requested_kg: number;
  priority: string;
  status: string;
  notes: string | null;
  scheduled_for: string | null;
  created_at: string;
};

function HolmaCentral() {
  const { isAdmin, loading } = useAuth();
  const [stations, setStations] = useState<StationPoint[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map());
  const [lots, setLots] = useState<LotRow[]>([]);
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [demand, setDemand] = useState({ wool_class: "A", message: "", target_kg: "" });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const [{ data: stationRows }, { data: lotRows }, { data: pickupRows }] = await Promise.all([
      supabase
        .from("collection_stations")
        .select("id, name, lat, lng, current_stock_kg, capacity_kg, contact_phone, approved, active")
        .eq("approved", true),
      supabase
        .from("wool_lots")
        .select("id, owner_id, estimated_kg, actual_kg, status, breed_codes")
        .in("status", ["registered", "in_transit", "at_station"]),
      supabase
        .from("pickup_requests")
        .select("id, owner_id, station_id, requested_kg, priority, status, notes, scheduled_for, created_at")
        .in("status", ["pending", "scheduled"])
        .order("created_at", { ascending: false }),
    ]);

    const ownerIds = Array.from(
      new Set((lotRows ?? []).map((l) => l.owner_id).filter(Boolean) as string[]),
    );
    const pickupOwnerIds = (pickupRows ?? [])
      .map((p) => p.owner_id)
      .filter((x): x is string => !!x);
    const allIds = Array.from(new Set([...ownerIds, ...pickupOwnerIds]));

    let profileMap = new Map<string, ProfileRow>();
    if (allIds.length > 0) {
      const { data: profRows } = await supabase
        .from("profiles")
        .select("id, full_name, farm_name, home_lat, home_lng")
        .in("id", allIds);
      profileMap = new Map((profRows ?? []).map((p) => [p.id, p as ProfileRow]));
    }

    setStations(
      ((stationRows ?? []) as StationPoint[]).filter((s) => s.lat != null && s.lng != null),
    );
    setLots((lotRows ?? []) as LotRow[]);
    setPickups((pickupRows ?? []) as PickupRow[]);
    setProfiles(profileMap);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  // Aggregate lots by owner location
  const owners = useMemo<OwnerPoint[]>(() => {
    const grouped = new Map<string, OwnerPoint>();
    for (const lot of lots) {
      const prof = profiles.get(lot.owner_id);
      if (!prof?.home_lat || !prof?.home_lng) continue;
      const kg = Number(lot.actual_kg ?? lot.estimated_kg ?? 0);
      const existing = grouped.get(lot.owner_id);
      if (existing) {
        existing.total_kg += kg;
        existing.lot_count += 1;
      } else {
        grouped.set(lot.owner_id, {
          id: lot.owner_id,
          label: prof.farm_name || prof.full_name || "Fårägare",
          lat: prof.home_lat,
          lng: prof.home_lng,
          total_kg: kg,
          lot_count: 1,
        });
      }
    }
    return Array.from(grouped.values());
  }, [lots, profiles]);

  const pickupPoints = useMemo<PickupPoint[]>(() => {
    const points: PickupPoint[] = [];
    for (const p of pickups) {
      let lat: number | null = null;
      let lng: number | null = null;
      let stationName: string | null = null;
      if (p.station_id) {
        const st = stations.find((s) => s.id === p.station_id);
        if (st) { lat = st.lat; lng = st.lng; stationName = st.name; }
      } else if (p.owner_id) {
        const prof = profiles.get(p.owner_id);
        if (prof?.home_lat && prof?.home_lng) { lat = prof.home_lat; lng = prof.home_lng; }
      }
      if (lat != null && lng != null) {
        points.push({
          id: p.id,
          lat, lng,
          requested_kg: Number(p.requested_kg),
          priority: p.priority,
          station_name: stationName,
        });
      }
    }
    return points;
  }, [pickups, stations, profiles]);

  const stats = useMemo(() => {
    const totalStock = stations.reduce((sum, s) => sum + s.current_stock_kg, 0);
    const totalCapacity = stations.reduce((sum, s) => sum + s.capacity_kg, 0);
    const inField = lots
      .filter((l) => l.status === "registered" || l.status === "in_transit")
      .reduce((sum, l) => sum + Number(l.actual_kg ?? l.estimated_kg ?? 0), 0);
    return { totalStock, totalCapacity, inField, pendingPickups: pickups.length };
  }, [stations, lots, pickups]);

  const broadcastDemand = async () => {
    if (!demand.message.trim()) {
      toast.error("Skriv ett meddelande");
      return;
    }
    const { error } = await supabase.from("support_messages").insert({
      subject: `[BEHOV] Klass ${demand.wool_class}${demand.target_kg ? ` – ${demand.target_kg} kg` : ""}`,
      message: `Holma efterfrågar ull av klass ${demand.wool_class}.\n\n${demand.message}`,
      status: "open",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Behov registrerat");
    setDemand({ wool_class: "A", message: "", target_kg: "" });
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Laddar…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Endast administratörer har åtkomst. <Link to="/app" className="underline">Tillbaka</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="Holma central"
        subtitle="Översikt: stationer, lager och hämtningar"
        back="/app"
      />

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Warehouse className="w-4 h-4" />} label="Lager totalt" value={`${stats.totalStock} kg`} />
          <StatCard icon={<Package className="w-4 h-4" />} label="Kapacitet" value={`${stats.totalCapacity} kg`} />
          <StatCard icon={<MapPin className="w-4 h-4" />} label="I fält / klart" value={`${Math.round(stats.inField)} kg`} />
          <StatCard icon={<Truck className="w-4 h-4" />} label="Hämtningskö" value={`${stats.pendingPickups}`} />
        </div>

        {/* Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Live-karta</h3>
            <Button variant="ghost" size="sm" onClick={load} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Uppdatera
            </Button>
          </div>
          <HolmaMap stations={stations} owners={owners} pickups={pickupPoints} />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <LegendDot color="#3b82f6" label="🏭 Insamlingsstation" />
            <LegendDot color="#16a34a" label="🐑 Fårägare med ull" />
            <LegendDot color="#f59e0b" label="🚚 Hämtning väntande" />
            <LegendDot color="#dc2626" label="🚚 Brådskande" />
          </div>
        </div>

        {/* Pickup queue */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="w-4 h-4" /> Hämtningskö ({pickups.length})
          </h3>
          {pickups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga väntande hämtningar.</p>
          ) : (
            <ul className="space-y-2">
              {pickups.map((p) => {
                const station = p.station_id ? stations.find((s) => s.id === p.station_id) : null;
                const owner = p.owner_id ? profiles.get(p.owner_id) : null;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {station?.name || owner?.farm_name || owner?.full_name || "Okänd"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.requested_kg} kg · {p.priority} · {new Date(p.created_at).toLocaleDateString("sv-SE")}
                        {p.scheduled_for && ` · planerad ${p.scheduled_for}`}
                      </div>
                      {p.notes && <div className="text-xs text-muted-foreground mt-1">{p.notes}</div>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      p.priority === "urgent" ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"
                    }`}>
                      {p.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Demand broadcast */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Efterfråga ull
          </h3>
          <p className="text-xs text-muted-foreground">
            Registrera behov av en specifik kvalitet. Skickas som internt meddelande till administratörer för vidare distribution.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Klass</Label>
              <select
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={demand.wool_class}
                onChange={(e) => setDemand({ ...demand, wool_class: e.target.value })}
              >
                {["A", "B", "C", "D", "E", "F"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Mål (kg)</Label>
              <Input
                type="number"
                value={demand.target_kg}
                onChange={(e) => setDemand({ ...demand, target_kg: e.target.value })}
                placeholder="t.ex. 500"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Meddelande</Label>
            <Textarea
              value={demand.message}
              onChange={(e) => setDemand({ ...demand, message: e.target.value })}
              placeholder="T.ex. Vi behöver fin merino-ull före midsommar…"
              rows={3}
            />
          </div>
          <Button onClick={broadcastDemand} className="w-full">Skicka efterfrågan</Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
