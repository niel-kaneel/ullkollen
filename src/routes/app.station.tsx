import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Warehouse, Plus, Loader2, Save, AlertTriangle, Truck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Station = {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  capacity_kg: number;
  current_stock_kg: number;
  approved: boolean;
  active: boolean;
  notes: string | null;
};

type IncomingDelivery = {
  id: string;
  status: string;
  scheduled_for: string | null;
  completed_at: string | null;
  wool_lot_id: string;
  shearer_id: string | null;
  distance_km: number | null;
  wool_lots?: { estimated_kg: number; actual_kg: number | null; status: string; owner_id: string } | null;
};

type PickupReq = {
  id: string;
  requested_kg: number;
  status: string;
  priority: string;
  scheduled_for: string | null;
  notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/app/station")({
  component: StationPage,
});

function StationPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState<Station | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from("collection_stations")
        .select("*")
        .eq("manager_user_id", user.id)
        .maybeSingle();
      setStation((data as Station | null) ?? null);
      setLoading(false);
    };
    void load();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!station) {
    return <ApplyForm onCreated={(s) => setStation(s)} />;
  }

  if (!station.approved) {
    return (
      <div className="space-y-4 pb-8">
        <PageHeader title={station.name} subtitle="Insamlingsstation" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Väntar på godkännande
            </CardTitle>
            <CardDescription>
              Din ansökan har skickats. En administratör granskar uppgifterna och aktiverar stationen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <ManagerDashboard station={station} onUpdate={(s) => setStation(s)} />;
}

function ApplyForm({ onCreated }: { onCreated: (s: Station) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [capacity, setCapacity] = useState("500");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !name.trim()) {
      toast.error("Namn krävs");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("collection_stations")
      .insert({
        manager_user_id: user.id,
        name: name.trim(),
        address: address.trim() || null,
        contact_phone: phone.trim() || null,
        contact_email: email.trim() || null,
        capacity_kg: Math.max(0, parseInt(capacity || "0", 10)),
        notes: notes.trim() || null,
        approved: false,
        active: true,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ansökan skickad");
    onCreated(data as Station);
  };

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Driv en insamlingsstation" subtitle="Ansök om att bli stationsansvarig" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ansökan</CardTitle>
          <CardDescription>
            Ullkollens administratör granskar din ansökan. När den godkänns kan du registrera inkommande ullpartier och hantera lager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Stationens namn *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Holma syd" />
          </Field>
          <Field label="Adress">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </Field>
            <Field label="E-post">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </Field>
          </div>
          <Field label="Lagerkapacitet (kg)">
            <Input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              type="number"
              inputMode="numeric"
              min={0}
            />
          </Field>
          <Field label="Anteckningar">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Skickar…" : "Skicka ansökan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ManagerDashboard({ station, onUpdate }: { station: Station; onUpdate: (s: Station) => void }) {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingDelivery[]>([]);
  const [pickups, setPickups] = useState<PickupReq[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: dels }, { data: pks }] = await Promise.all([
        supabase
          .from("deliveries")
          .select("id, status, scheduled_for, completed_at, wool_lot_id, shearer_id, distance_km, wool_lots:wool_lots(estimated_kg, actual_kg, status, owner_id)")
          .eq("destination_station_id", station.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("pickup_requests")
          .select("*")
          .eq("station_id", station.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setIncoming((dels as IncomingDelivery[]) ?? []);
      setPickups((pks as PickupReq[]) ?? []);
    };
    void load();
  }, [station.id, reload]);

  const utilization = station.capacity_kg > 0
    ? Math.round((station.current_stock_kg / station.capacity_kg) * 100)
    : 0;
  const isFull = utilization >= 90;

  const addStock = async (kg: number) => {
    const { data, error } = await supabase.rpc("bump_station_stock", {
      _station_id: station.id,
      _delta_kg: kg,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) onUpdate(data as Station);
  };

  const requestPickup = async () => {
    if (!user) return;
    const { error } = await supabase.from("pickup_requests").insert({
      station_id: station.id,
      requested_kg: station.current_stock_kg,
      priority: isFull ? "high" : "normal",
      status: "pending",
      notes: isFull ? "Lager fullt" : null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Hämtning begärd");
    setReload((n) => n + 1);
  };

  const markCompleted = async (d: IncomingDelivery) => {
    const kg = Number(d.wool_lots?.actual_kg ?? d.wool_lots?.estimated_kg ?? 0);
    const { error } = await supabase
      .from("deliveries")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (d.wool_lot_id) {
      await supabase.from("wool_lots").update({ status: "at_station" }).eq("id", d.wool_lot_id);
    }
    if (kg > 0) await addStock(kg);
    toast.success("Mottagning registrerad");
    setReload((n) => n + 1);
  };

  return (
    <div className="space-y-4 pb-10">
      <PageHeader title={station.name} subtitle="Insamlingsstation" />

      {/* Stock dashboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Warehouse className="w-4 h-4" /> Lagerstatus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-2xl font-bold">{station.current_stock_kg} kg</span>
              <span className="text-sm text-muted-foreground">av {station.capacity_kg} kg</span>
            </div>
            <Progress value={Math.min(100, utilization)} className={isFull ? "bg-destructive/20" : ""} />
            <p className={`text-xs mt-1.5 ${isFull ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {utilization}% fyllt {isFull && "— lager nästan fullt!"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={requestPickup} className="flex-1" variant={isFull ? "default" : "outline"}>
              <Truck className="w-4 h-4 mr-1.5" />
              Begär hämtning
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Incoming deliveries */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Inkommande partier</CardTitle>
          <ManualLotDialog stationId={station.id} onAdded={() => setReload((n) => n + 1)} />
        </CardHeader>
        <CardContent className="space-y-2">
          {incoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga inkommande partier ännu.</p>
          ) : (
            incoming.map((d) => {
              const kg = Number(d.wool_lots?.actual_kg ?? d.wool_lots?.estimated_kg ?? 0);
              const isDone = d.status === "completed";
              return (
                <div key={d.id} className="border border-border rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{kg} kg • {d.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.scheduled_for ?? d.completed_at?.slice(0, 10) ?? new Date().toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                  {!isDone && (
                    <Button size="sm" onClick={() => markCompleted(d)}>
                      Mottag
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Pickup requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mina hämtningsförfrågningar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pickups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga aktiva hämtningar.</p>
          ) : (
            pickups.map((p) => (
              <div key={p.id} className="border border-border rounded-xl px-3 py-2.5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{p.requested_kg} kg • {p.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.priority === "high" ? "🔥 Hög prio • " : ""}
                    {new Date(p.created_at).toLocaleDateString("sv-SE")}
                  </p>
                  {p.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{p.notes}</p>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <SettingsCard station={station} onUpdate={onUpdate} />
    </div>
  );
}

function ManualLotDialog({ stationId, onAdded }: { stationId: string; onAdded: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!user) return;
    const weight = parseFloat(kg);
    if (!weight || weight <= 0) {
      toast.error("Ange vikt");
      return;
    }
    setBusy(true);
    // Create a lot owned by station manager (proxy entry), then a completed delivery.
    const { data: lot, error: lotErr } = await supabase
      .from("wool_lots")
      .insert({
        owner_id: user.id,
        estimated_kg: weight,
        actual_kg: weight,
        status: "at_station",
        notes: "Registrerad direkt på station (proxy)",
      })
      .select("id")
      .single();
    if (lotErr || !lot) {
      setBusy(false);
      toast.error(lotErr?.message ?? "Fel");
      return;
    }
    const { error: delErr } = await supabase.from("deliveries").insert({
      wool_lot_id: lot.id,
      destination_station_id: stationId,
      method: "dropoff_station",
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    if (delErr) {
      setBusy(false);
      toast.error(delErr.message);
      return;
    }
    // Atomic stock bump
    const { error: bumpErr } = await supabase.rpc("bump_station_stock", {
      _station_id: stationId,
      _delta_kg: weight,
    });
    setBusy(false);
    if (bumpErr) {
      toast.error(bumpErr.message);
      return;
    }
    toast.success(`${weight} kg registrerat`);
    setKg("");
    setOpen(false);
    onAdded();
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Registrera
      </Button>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={kg}
        onChange={(e) => setKg(e.target.value)}
        className="h-8 w-20"
      />
      <Button size="sm" onClick={add} disabled={busy}>OK</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>×</Button>
    </div>
  );
}

function SettingsCard({ station, onUpdate }: { station: Station; onUpdate: (s: Station) => void }) {
  const [capacity, setCapacity] = useState(String(station.capacity_kg));
  const [stock, setStock] = useState(String(station.current_stock_kg));
  const [phone, setPhone] = useState(station.contact_phone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("collection_stations")
      .update({
        capacity_kg: Math.max(0, parseInt(capacity || "0", 10)),
        current_stock_kg: Math.max(0, parseInt(stock || "0", 10)),
        contact_phone: phone.trim() || null,
      })
      .eq("id", station.id)
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sparat");
    onUpdate(data as Station);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Inställningar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kapacitet (kg)">
            <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" />
          </Field>
          <Field label="Aktuellt lager (kg)">
            <Input value={stock} onChange={(e) => setStock(e.target.value)} type="number" />
          </Field>
        </div>
        <Field label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </Field>
        <Button onClick={save} disabled={busy} className="w-full">
          <Save className="w-4 h-4 mr-1.5" />
          {busy ? "Sparar…" : "Spara"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
