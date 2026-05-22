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
import { useTranslation, type Translatable } from "@/lib/i18n";
import { getClassRange } from "@/lib/wool-classes";

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

function getTiers(t: (k: Translatable) => string) {
  return {
    forKg(kg: number): Tier {
      if (kg < 50) {
        return {
          key: "u50",
          label: t("tierU50Label"),
          desc: t("tierU50Desc"),
          options: [
            { method: "dropoff_station", title: t("optDropoffNearestTitle"), sub: t("optDropoffNearestSub"), icon: MapPin },
            { method: "with_shearer", title: t("optWithShearerTitle"), sub: t("optWithShearerSub"), icon: Users },
          ],
        };
      }
      if (kg < 100) {
        return {
          key: "u100",
          label: t("tierU100Label"),
          desc: t("tierU100Desc"),
          options: [
            { method: "dropoff_station", title: t("optDropoffTitle"), sub: t("optDropoffSub"), icon: MapPin },
            { method: "with_shearer", title: t("optWithShearerTitle"), sub: t("optWithShearerSub"), icon: Users },
          ],
        };
      }
      if (kg < 500) {
        return {
          key: "u500",
          label: t("tierU500Label"),
          desc: t("tierU500Desc"),
          options: [
            { method: "dropoff_station", title: t("optDropoffTitle"), sub: t("optDropoffSub"), icon: MapPin },
            { method: "with_shearer", title: t("optWithShearerTitle"), sub: t("optWithShearerSub"), icon: Users },
            { method: "pickup", title: t("optPickupTitle"), sub: t("optPickupSub"), icon: Truck },
          ],
        };
      }
      return {
        key: "p500",
        label: t("tierP500Label"),
        desc: t("tierP500Desc"),
        options: [
          { method: "pickup", title: t("optPriorityPickupTitle"), sub: t("optPriorityPickupSub"), icon: Zap },
          { method: "dropoff_station", title: t("optDropoffTitle"), sub: t("optDropoffSub"), icon: MapPin },
          { method: "with_shearer", title: t("optWithShearerTitle"), sub: t("optWithShearerSub"), icon: Users },
        ],
      };
    },
  };
}

function SellWool() {
  const { t, lang } = useTranslation();
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
    toast.success(t("deletedSuccess"));
    setLots((l) => l.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="pt-2 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/app"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">{t("selling")}</p>
          <h2 className="font-display text-2xl font-bold text-primary">{t("sellWool")}</h2>
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
          {t("registerBatch")}
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
          {t("myBatches")}
        </h3>
        {!loaded ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : lots.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-soft">
            <Package className="w-10 h-10 mx-auto mb-3 text-accent" />
            <p className="text-sm text-muted-foreground">{t("noBatchesYet")}</p>
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
                      {statusLabel(l.status, t)}
                    </span>
                  </div>
                  {l.notes && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{l.notes}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(l.created_at).toLocaleString(lang === "sv" ? "sv-SE" : "en-GB")}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button aria-label={t("remove")} className="p-2 text-muted-foreground hover:text-destructive rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("removeBatch")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("cannotBeUndone")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {t("remove")}
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

function statusLabel(s: string, t: (k: Translatable) => string) {
  switch (s) {
    case "registered": return t("statusRegistered");
    case "in_transit": return t("statusInTransit");
    case "at_station": return t("statusAtStation");
    case "at_holma": return t("statusAtHolma");
    case "classified": return t("statusClassified");
    case "paid": return t("statusPaid");
    case "cancelled": return t("statusCancelled");
    default: return s;
  }
}

type ShearerOpt = { id: string; display_name: string };
type StationOpt = { id: string; name: string; current_stock_kg: number; capacity_kg: number };
type RecentClass = { id: string; wool_class: string | null; wool_class_name_sv: string | null; confidence: string | null; user_confirmed: boolean; created_at: string };

function NewLotForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [kg, setKg] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [sharePct, setSharePct] = useState(20);
  const [shearerId, setShearerId] = useState<string | null>(null);
  const [shearers, setShearers] = useState<ShearerOpt[]>([]);
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [stationId, setStationId] = useState<string | null>(null);
  const [classificationId, setClassificationId] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentClass[]>([]);
  const [upgradedToLikely, setUpgradedToLikely] = useState(false);
  const [saving, setSaving] = useState(false);

  const kgNum = Number(kg);
  const validKg = !Number.isNaN(kgNum) && kgNum > 0;
  const tier = validKg ? getTiers(t).forKg(kgNum) : null;

  useEffect(() => {
    void supabase
      .from("shearers")
      .select("id, display_name")
      .eq("approved", true)
      .eq("active", true)
      .order("display_name")
      .then(({ data }) => setShearers((data as ShearerOpt[]) ?? []));
    void supabase
      .from("collection_stations")
      .select("id, name, current_stock_kg, capacity_kg")
      .eq("approved", true)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setStations((data as StationOpt[]) ?? []));
    if (user) {
      void supabase
        .from("classifications")
        .select("id, wool_class, wool_class_name_sv, confidence, user_confirmed, created_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("wool_class", "is", null)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => setRecents((data as RecentClass[]) ?? []));
    }
  }, [user]);

  const save = async () => {
    if (!user || !validKg || !method) return;
    if (method === "with_shearer" && !shearerId) {
      return toast.error(t("selectShearer"));
    }
    if ((method === "dropoff_station" || method === "pickup") && !stationId) {
      return toast.error(t("selectStation"));
    }
    if (method === "with_shearer" && sharePct < 20) {
      return toast.error(t("sharePercent"));
    }
    setSaving(true);
    // Append the chosen registered class to notes so it's persisted as part of the lot record.
    let composedNotes = notes || null;
    const linkedRecent = recents.find((x) => x.id === classificationId);
    if (linkedRecent) {
      const range = getClassRange(linkedRecent.wool_class, linkedRecent.confidence, linkedRecent.user_confirmed);
      if (range && !range.collapsed && range.floor !== range.likely) {
        const registered = upgradedToLikely ? range.likely : range.floor;
        const tag = upgradedToLikely
          ? `Registrerad som ${registered} (uppgraderad från säker klass ${range.floor}, bekräftad via känsel).`
          : `Registrerad som ${registered} (säker klass; trolig högre klass ${range.likely}).`;
        composedNotes = composedNotes ? `${composedNotes}\n\n${tag}` : tag;
      }
    }
    const { data: lot, error: e1 } = await supabase
      .from("wool_lots")
      .insert({
        owner_id: user.id,
        estimated_kg: kgNum,
        notes: composedNotes,
        status: "registered",
        classification_id: classificationId,
      })
      .select("id")
      .single();
    if (e1 || !lot) { setSaving(false); return toast.error(e1?.message ?? t("couldNotSave")); }

    const { error: e2 } = await supabase.from("deliveries").insert({
      wool_lot_id: lot.id,
      method,
      shearer_id: method === "with_shearer" ? shearerId : null,
      destination_station_id:
        method === "dropoff_station" || method === "pickup" ? stationId : null,
      status: "pending",
    });
    if (e2) { setSaving(false); return toast.error(e2.message); }

    if (method === "with_shearer" && shearerId) {
      const { error: e3 } = await supabase.from("revenue_shares").insert({
        wool_lot_id: lot.id,
        shearer_id: shearerId,
        percent: sharePct,
      });
      if (e3) { setSaving(false); return toast.error(e3.message); }
    }

    haptic("success");
    toast.success(t("batchRegistered"));
    setSaving(false);
    onCreated();
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-5 shadow-soft space-y-5">
      <div>
        <Label htmlFor="kg" className="text-sm font-semibold">{t("howMuchWool")}</Label>
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

      {recents.length > 0 && (
        <div>
          <Label className="text-sm font-semibold">{t("linkToClassification")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t("linkToClassificationDesc")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setClassificationId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${
                classificationId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
              }`}
            >
              {t("noClassification")}
            </button>
            {recents.map((r) => {
              const range = getClassRange(r.wool_class, r.confidence, r.user_confirmed);
              const showFloor = range && !range.collapsed && range.floor !== range.likely;
              const label = showFloor
                ? `${range!.floor} – ${range!.likely}`
                : (r.wool_class ?? "?");
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setClassificationId(r.id); setUpgradedToLikely(false); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${
                    classificationId === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}
                >
                  {label} {r.wool_class_name_sv ? `· ${r.wool_class_name_sv}` : ""}
                </button>
              );
            })}
          </div>

          {(() => {
            const r = recents.find((x) => x.id === classificationId);
            if (!r) return null;
            const range = getClassRange(r.wool_class, r.confidence, r.user_confirmed);
            if (!range || range.collapsed || range.floor === range.likely) return null;
            const registered = upgradedToLikely ? range.likely : range.floor;
            return (
              <div className="mt-3 bg-primary/5 border border-primary/30 rounded-2xl p-3 text-sm">
                <p className="font-semibold">
                  Registreras som <span className="text-primary">{registered}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vi föreslår <strong>{range.floor}</strong> som säker klass. Har du bekräftat högre kvalitet via känsel? Uppgradera till <strong>{range.likely}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => { haptic("tap"); setUpgradedToLikely((v) => !v); }}
                  className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                >
                  {upgradedToLikely
                    ? `← Återgå till ${range.floor} (säker)`
                    : `Uppgradera till ${range.likely} →`}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      <div>
        <Label htmlFor="notes" className="text-sm font-semibold">{t("notes")}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
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
          <Label className="text-sm font-semibold">{t("chooseDelivery")}</Label>
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

      {(method === "dropoff_station" || method === "pickup") && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 space-y-2">
          <Label className="text-sm font-semibold">{t("chooseStation")}</Label>
          {stations.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noStationsAvailable")}</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {stations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStationId(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${
                    stationId === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}
                >
                  {s.name} ({s.current_stock_kg}/{s.capacity_kg} kg)
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {method === "with_shearer" && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 space-y-4">
          <div>
            <Label className="text-sm font-semibold">{t("chooseShearer")}</Label>
            {shearers.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">{t("noShearersAvailable")}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {shearers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShearerId(s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${
                      shearerId === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                    }`}
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="share" className="text-sm font-semibold">{t("revenueShare")}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t("revenueShareDesc")}</p>
            <div className="flex items-center gap-3 mt-2">
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
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={onCancel}>{t("cancel")}</Button>
        <Button
          className="flex-1 rounded-2xl h-12"
          disabled={!validKg || !method || saving}
          onClick={save}
        >
          {saving ? t("saving") : t("register")}
        </Button>
      </div>
    </div>
  );
}
