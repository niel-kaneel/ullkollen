import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Package, Truck, MapPin, Users, Zap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

export const Route = createFileRoute("/app/sell")({
  component: SellWool,
});

type Lot = {
  id: string;
  estimated_kg: number;
  actual_kg: number | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type DeliveryMethod = "dropoff_station" | "with_shearer" | "pickup";

type Tier = {
  key: "u50" | "u100" | "u500" | "p500";
  label: string;
  desc: string;
  options: { method: DeliveryMethod; title: string; sub: string; icon: React.ComponentType<{ className?: string }> }[];
};

function tierFor(kg: number): Tier {
  if (kg < 50) {
    return {
      key: "u50",
      label: "Under 50 kg",
      desc: "Mindre volym — välj enklaste vägen.",
      options: [
        { method: "dropoff_station", title: "Lämna på närmaste insamlingsstation", sub: "Du kör själv till stationen.", icon: MapPin },
        { method: "with_shearer", title: "Skicka med klippare", sub: "Avtala intäktsdelning (min 20%).", icon: Users },
      ],
    };
  }
  if (kg < 100) {
    return {
      key: "u100",
      label: "50–99 kg",
      desc: "Samma alternativ som under 50 kg, intäktsdelning gäller.",
      options: [
        { method: "dropoff_station", title: "Lämna på insamlingsstation", sub: "Du kör själv.", icon: MapPin },
        { method: "with_shearer", title: "Skicka med klippare", sub: "Avtala intäktsdelning (min 20%).", icon: Users },
      ],
    };
  }
  if (kg < 500) {
    return {
      key: "u500",
      label: "100–499 kg",
      desc: "Större volym — upphämtning kan bokas när det finns tillräckligt i området.",
      options: [
        { method: "dropoff_station", title: "Lämna på insamlingsstation", sub: "Du kör själv.", icon: MapPin },
        { method: "with_shearer", title: "Skicka med klippare", sub: "Avtala intäktsdelning (min 20%).", icon: Users },
        { method: "pickup", title: "Boka upphämtning", sub: "Vi samordnar med andra i området.", icon: Truck },
      ],
    };
  }
  return {
    key: "p500",
    label: "500 kg eller mer",
    desc: "Stor volym — prioriterad upphämtning är tillgänglig.",
    options: [
      { method: "pickup", title: "Prioriterad upphämtning", sub: "Snabbare bokning, vi planerar rutten.", icon: Zap },
      { method: "dropoff_station", title: "Lämna på insamlingsstation", sub: "Du kör själv.", icon: MapPin },
      { method: "with_shearer", title: "Skicka med klippare", sub: "Avtala intäktsdelning (min 20%).", icon: Users },
    ],
  };
}

function SellWool() {
  const { user } = useAuth();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wool_lots")
      .select("id, estimated_kg, actual_kg, status, notes, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setLots((data as Lot[]) ?? []);
    setLoaded(true);
  };

  useEffect(() => { void load(); }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("wool_lots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    haptic("success");
    toast.success("Borttaget");
    setLots((l) => l.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="pt-2 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/app"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Försäljning</p>
          <h2 className="font-display text-2xl font-bold text-primary">Sälj din ull</h2>
        </div>
      </div>

      {!showForm && (
        <Button
          onClick={() => { haptic("tap"); setShowForm(true); }}
          size="lg"
          className="w-full h-16 rounded-3xl text-primary-foreground"
          style={{ background: "var(--gradient-pine)" }}
        >
          <Plus className="w-5 h-5 mr-2" strokeWidth={3} />
          Registrera ny ullbatch
        </Button>
      )}

      {showForm && (
        <NewLotForm
          onCancel={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); void load(); }}
        />
      )}

      <div>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.25em] mb-3">
          Mina batcher
        </h3>
        {!loaded ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : lots.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-soft">
            <Package className="w-10 h-10 mx-auto mb-3 text-accent" />
            <p className="text-sm text-muted-foreground">Inga registrerade batcher ännu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lots.map((l) => (
              <div key={l.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft flex items-start gap-3">
                <div className="bg-secondary rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{Number(l.estimated_kg).toFixed(1)} kg</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {statusLabel(l.status)}
                    </span>
                  </div>
                  {l.notes && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{l.notes}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(l.created_at).toLocaleString("sv-SE")}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button aria-label="Ta bort" className="p-2 text-muted-foreground hover:text-destructive rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ta bort batch?</AlertDialogTitle>
                      <AlertDialogDescription>Detta kan inte ångras.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Ta bort
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case "registered": return "Registrerad";
    case "in_transit": return "På väg";
    case "at_station": return "På station";
    case "at_holma": return "På Holma";
    case "classified": return "Klassad";
    case "paid": return "Utbetald";
    case "cancelled": return "Avbruten";
    default: return s;
  }
}

function NewLotForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [kg, setKg] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [sharePct, setSharePct] = useState(20);
  const [saving, setSaving] = useState(false);

  const kgNum = Number(kg);
  const validKg = !Number.isNaN(kgNum) && kgNum > 0;
  const tier = validKg ? tierFor(kgNum) : null;

  const save = async () => {
    if (!user || !validKg || !method) return;
    setSaving(true);
    const { data: lot, error: e1 } = await supabase
      .from("wool_lots")
      .insert({ owner_id: user.id, estimated_kg: kgNum, notes: notes || null, status: "registered" })
      .select("id")
      .single();
    if (e1 || !lot) { setSaving(false); return toast.error(e1?.message ?? "Kunde inte spara"); }

    const { error: e2 } = await supabase.from("deliveries").insert({
      wool_lot_id: lot.id,
      method,
      status: "pending",
    });
    if (e2) { setSaving(false); return toast.error(e2.message); }

    if (method === "with_shearer") {
      // Note: shearer is selected later when booking; we record the % intent on the lot via notes for now.
      // A proper revenue_shares row is created when the shearer is assigned.
      await supabase.from("wool_lots").update({
        notes: `${notes ? notes + "\n" : ""}Avtalad andel till klippare: ${sharePct}%`,
      }).eq("id", lot.id);
    }

    haptic("success");
    toast.success("Batch registrerad");
    setSaving(false);
    onCreated();
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-5 shadow-soft space-y-5">
      <div>
        <Label htmlFor="kg" className="text-sm font-semibold">Hur mycket ull vill du sälja?</Label>
        <div className="flex items-center gap-2 mt-2">
          <Input
            id="kg"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="t.ex. 35"
            className="text-lg h-14 rounded-2xl"
          />
          <span className="text-base font-semibold text-muted-foreground">kg</span>
        </div>
      </div>

      <div>
        <Label htmlFor="notes" className="text-sm font-semibold">Anteckningar (valfritt)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ras, kvalitet, särskilda önskemål…"
          className="mt-2 rounded-2xl"
          rows={2}
        />
      </div>

      {tier && (
        <div className="space-y-3">
          <div className="bg-secondary/50 rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{tier.label}</p>
            <p className="text-sm mt-0.5">{tier.desc}</p>
          </div>
          <Label className="text-sm font-semibold">Välj leveranssätt</Label>
          <div className="space-y-2">
            {tier.options.map((opt) => {
              const Icon = opt.icon;
              const active = method === opt.method;
              return (
                <button
                  key={opt.method}
                  type="button"
                  onClick={() => { haptic("tap"); setMethod(opt.method); }}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition flex items-start gap-3 ${
                    active ? "bg-primary/10 border-primary" : "bg-background border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`rounded-xl p-2 flex-shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{opt.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {method === "with_shearer" && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 space-y-3">
          <div>
            <Label htmlFor="share" className="text-sm font-semibold">Andel av intäkt till klipparen</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Minst 20%. Klipparen får sin andel automatiskt utbetald när ullen sålts.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="share"
              type="range"
              min={20}
              max={50}
              step={1}
              value={sharePct}
              onChange={(e) => setSharePct(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="font-bold text-lg w-14 text-right">{sharePct}%</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={onCancel}>Avbryt</Button>
        <Button
          className="flex-1 rounded-2xl h-12"
          disabled={!validKg || !method || saving}
          onClick={save}
        >
          {saving ? "Sparar…" : "Registrera"}
        </Button>
      </div>
    </div>
  );
}
