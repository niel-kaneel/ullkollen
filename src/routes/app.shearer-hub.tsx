import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Truck, Wallet, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useTranslation, type Translatable } from "@/lib/i18n";

function deliveryStatusLabel(status: string, t: (k: Translatable) => string): string {
  switch (status) {
    case "pending": return t("statusPending");
    case "accepted": return t("bookingAccepted");
    case "declined": return t("bookingDeclined");
    case "cancelled": return t("bookingCancelled");
    case "completed": return t("bookingCompleted");
    case "in_transit": return t("statusInTransit");
    case "at_station": return t("statusAtStation");
    default: return status;
  }
}

type Shearer = {
  id: string;
  display_name: string;
  collects_wool: boolean;
  wool_capacity_kg: number;
  has_trailer: boolean;
  mileage_rate_with_trailer_sek: number;
  mileage_rate_without_trailer_sek: number;
  approved: boolean | null;
  active: boolean | null;
};

type Share = {
  id: string;
  percent: number;
  amount_sek: number | null;
  paid_at: string | null;
  created_at: string;
  wool_lot_id: string;
};

type Delivery = {
  id: string;
  status: string;
  scheduled_for: string | null;
  completed_at: string | null;
  distance_km: number | null;
  mileage_sek: number | null;
};

export const Route = createFileRoute("/app/shearer-hub")({
  component: ShearerHubPage,
});

function ShearerHubPage() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shearer, setShearer] = useState<Shearer | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [saving, setSaving] = useState(false);

  // Local edit state
  const [collectsWool, setCollectsWool] = useState(false);
  const [capacity, setCapacity] = useState("0");
  const [hasTrailer, setHasTrailer] = useState(false);
  const [rateWith, setRateWith] = useState("30");
  const [rateWithout, setRateWithout] = useState("20");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data: sh } = await supabase
        .from("shearers")
        .select("id, display_name, collects_wool, wool_capacity_kg, has_trailer, mileage_rate_with_trailer_sek, mileage_rate_without_trailer_sek, approved, active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (sh) {
        const s = sh as Shearer;
        setShearer(s);
        setCollectsWool(s.collects_wool);
        setCapacity(String(s.wool_capacity_kg ?? 0));
        setHasTrailer(s.has_trailer);
        setRateWith(String(s.mileage_rate_with_trailer_sek ?? 30));
        setRateWithout(String(s.mileage_rate_without_trailer_sek ?? 20));

        const [{ data: shareRows }, { data: delRows }] = await Promise.all([
          supabase
            .from("revenue_shares")
            .select("id, percent, amount_sek, paid_at, created_at, wool_lot_id")
            .eq("shearer_id", s.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("deliveries")
            .select("id, status, scheduled_for, completed_at, distance_km, mileage_sek")
            .eq("shearer_id", s.id)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);
        setShares((shareRows as Share[]) ?? []);
        setDeliveries((delRows as Delivery[]) ?? []);
      }
      setLoading(false);
    };
    void load();
  }, [user?.id]);

  const totals = useMemo(() => {
    const earned = shares.reduce((s, r) => s + Number(r.amount_sek ?? 0), 0);
    const paid = shares.filter((r) => r.paid_at).reduce((s, r) => s + Number(r.amount_sek ?? 0), 0);
    const pending = earned - paid;
    const mileage = deliveries.reduce((s, d) => s + Number(d.mileage_sek ?? 0), 0);
    const km = deliveries.reduce((s, d) => s + Number(d.distance_km ?? 0), 0);
    return { earned, paid, pending, mileage, km };
  }, [shares, deliveries]);

  const save = async () => {
    if (!shearer) return;
    setSaving(true);
    const { error } = await supabase
      .from("shearers")
      .update({
        collects_wool: collectsWool,
        wool_capacity_kg: Math.max(0, parseInt(capacity || "0", 10)),
        has_trailer: hasTrailer,
        mileage_rate_with_trailer_sek: Math.max(0, Number(rateWith || 0)),
        mileage_rate_without_trailer_sek: Math.max(0, Number(rateWithout || 0)),
      })
      .eq("id", shearer.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("savedSuccess"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shearer) {
    return (
      <div className="space-y-4 pb-8">
        <PageHeader title={t("shearerHub")} subtitle={t("shearerHubSubtitle")} />
        <Card>
          <CardHeader>
            <CardTitle>{t("noShearerProfile")}</CardTitle>
            <CardDescription>
              {t("noShearerProfileDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/auth" search={{ role: "shearer" } as any}>
                {t("createShearerProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader title={t("shearerHub")} subtitle={shearer.display_name} />

      <Button asChild variant="outline" className="w-full rounded-2xl">
        <Link to="/app/route-planner"><Truck className="w-4 h-4 mr-2" />{t("planPickupRoute")}</Link>
      </Button>

      {/* Earnings summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4" /> {t("myEarnings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Stat label={t("totalEarned")} value={`${fmt(totals.earned)} kr`} />
          <Stat label={t("paid")} value={`${fmt(totals.paid)} kr`} />
          <Stat label={t("pending")} value={`${fmt(totals.pending)} kr`} highlight />
          <Stat label={t("mileageComp")} value={`${fmt(totals.mileage)} kr`} sub={`${totals.km.toFixed(0)} km`} />
        </CardContent>
      </Card>

      {/* Collector toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="w-4 h-4" /> {t("woolCollection")}
          </CardTitle>
          <CardDescription>
            {t("woolCollectionDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="collects" className="text-sm font-medium">
              {t("iCollectWool")}
            </Label>
            <Switch id="collects" checked={collectsWool} onCheckedChange={setCollectsWool} />
          </div>

          {collectsWool && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="capacity" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("capacityLabel")}
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="trailer" className="text-sm font-medium">
                  {t("iHaveTrailer")}
                </Label>
                <Switch id="trailer" checked={hasTrailer} onCheckedChange={setHasTrailer} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rate-with" className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("rateWithTrailer")}
                  </Label>
                  <Input
                    id="rate-with"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={rateWith}
                    onChange={(e) => setRateWith(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-without" className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("rateWithoutTrailer")}
                  </Label>
                  <Input
                    id="rate-without"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={rateWithout}
                    onChange={(e) => setRateWithout(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("rateGuideline")}
              </p>
            </>
          )}

          <Button onClick={save} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? t("saving") : t("save")}
          </Button>
        </CardContent>
      </Card>

      {/* Recent deliveries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("myDeliveries")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDeliveriesYet")}</p>
          ) : (
            deliveries.slice(0, 8).map((d) => (
              <div key={d.id} className="flex items-center justify-between border border-border rounded-xl px-3 py-2 text-sm">
                <div>
                  <p className="font-medium capitalize">{deliveryStatusLabel(d.status, t)}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.scheduled_for ?? d.completed_at?.slice(0, 10) ?? "—"}
                    {d.distance_km != null ? ` • ${Number(d.distance_km).toFixed(0)} km` : ""}
                  </p>
                </div>
                <div className="text-right font-semibold">
                  {d.mileage_sek != null ? `${fmt(Number(d.mileage_sek))} kr` : "—"}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent shares */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("sharesFromLots")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSharesYet")}</p>
          ) : (
            shares.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between border border-border rounded-xl px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{s.percent}{t("sharePercentLabel")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString(lang === "sv" ? "sv-SE" : "en-GB")}
                    {s.paid_at ? ` • ${t("paidOut")}` : ` • ${t("pending")}`}
                  </p>
                </div>
                <div className="text-right font-semibold">
                  {s.amount_sek != null ? `${fmt(Number(s.amount_sek))} kr` : "—"}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${highlight ? "bg-accent/10" : "bg-card"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);
}
