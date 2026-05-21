import { createFileRoute, redirect, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Shield, Users, Trash2, ShieldOff, ShieldCheck, ChevronDown, ChevronUp,
  Mail, KeyRound, Download, Inbox, Send, Warehouse, Check, X,
  LayoutDashboard, Package, Truck, Calendar as CalendarIcon, Scissors,
  TrendingUp, AlertCircle, Activity, Copy, Search, Phone, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { breedLabel } from "@/lib/breeds";

// ─── Types ───────────────────────────────────────────────────────────────
type AdminUser = {
  id: string; email: string; created_at: string;
  full_name: string | null; first_name: string | null; last_name: string | null;
  farm_name: string | null; phone: string | null; address: string | null;
  is_admin: boolean; classifications_count: number; sheep_count: number;
};
type SupportRow = {
  id: string; user_id: string | null; email: string | null;
  subject: string; message: string; status: string;
  admin_notes: string | null; created_at: string;
};
type Detail = {
  profile: Record<string, unknown> | null;
  sheep: Array<Record<string, unknown>>;
  classifications: Array<Record<string, unknown>>;
  support_messages: Array<Record<string, unknown>>;
};
type Station = { id: string; name: string; address: string | null; capacity_kg: number; current_stock_kg: number; approved: boolean; active: boolean; manager_user_id: string | null; contact_phone: string | null; contact_email: string | null; created_at: string };
type WoolLot = { id: string; owner_id: string; status: string; estimated_kg: number; actual_kg: number | null; breed_codes: string[] | null; notes: string | null; created_at: string };
type Delivery = { id: string; wool_lot_id: string; method: string; status: string; origin_station_id: string | null; destination_station_id: string | null; shearer_id: string | null; distance_km: number | null; mileage_sek: number | null; scheduled_for: string | null; created_at: string };
type PickupRequest = { id: string; station_id: string | null; owner_id: string | null; requested_kg: number; priority: string; status: string; scheduled_for: string | null; notes: string | null; created_at: string };
type Booking = { id: string; farmer_id: string; shearer_id: string; status: string; sheep_count: number | null; preferred_date: string | null; contact_phone: string | null; message: string | null; created_at: string };
type ShearerRow = { id: string; user_id: string | null; display_name: string; phone: string | null; email: string | null; approved: boolean | null; active: boolean | null; collects_wool: boolean; wool_capacity_kg: number; has_trailer: boolean; hourly_rate_sek: number | null; service_areas: string[] | null; languages: string[] | null; breed_specialties: string[] | null; certified_by_farklipparforbundet: boolean | null; listed_by_faravelsforbundet: boolean | null; created_at: string };
type Dashboard = {
  authorized: boolean;
  totals: Record<string, number>;
  pending: Record<string, number>;
  growth: Record<string, number>;
  lots_by_status: Record<string, number>;
  deliveries_by_status: Record<string, number>;
  bookings_by_status: Record<string, number>;
  top_farms: Array<{ id: string; name: string; sheep_count: number; classifications_count: number }>;
  top_shearers: Array<{ id: string; display_name: string; bookings_count: number; deliveries_count: number }>;
  activity: Array<{ kind: string; ref: string; ts: string; title: string | null; actor_id: string | null }>;
};

// ─── Route ───────────────────────────────────────────────────────────────
export const Route = createFileRoute("/app/admin")({
  beforeLoad: async () => {
    // Only check the persisted browser session on the client. During SSR the
    // session storage is unavailable, so this would otherwise redirect signed-in
    // admins when opening nested admin pages such as Expertkunskap.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: AdminRoute,
});

function AdminRoute() {
  const location = useLocation();
  if (location.pathname !== "/app/admin") return <Outlet />;
  return <Admin />;
}

function Admin() {
  const { t } = useTranslation();
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState("overview");

  // Data state
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [support, setSupport] = useState<SupportRow[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [lots, setLots] = useState<WoolLot[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shearers, setShearers] = useState<ShearerRow[]>([]);
  const [details, setDetails] = useState<Record<string, Detail>>({});

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body });
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data;
  };

  const loadAll = async () => {
    const [d, u, s, st, l, dl, pk, bk, sh] = await Promise.all([
      supabase.rpc("admin_dashboard"),
      supabase.rpc("admin_list_users"),
      supabase.from("support_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("collection_stations").select("*").order("created_at", { ascending: false }),
      supabase.from("wool_lots").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("deliveries").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("pickup_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("shearers").select("*").order("created_at", { ascending: false }),
    ]);
    if (d.error) toast.error(d.error.message); else setDash(d.data as Dashboard);
    if (u.error) toast.error(u.error.message); else setUsers((u.data as AdminUser[]) ?? []);
    if (s.error) toast.error(s.error.message); else setSupport((s.data as SupportRow[]) ?? []);
    if (st.error) toast.error(st.error.message); else setStations((st.data as Station[]) ?? []);
    if (l.error) toast.error(l.error.message); else setLots((l.data as WoolLot[]) ?? []);
    if (dl.error) toast.error(dl.error.message); else setDeliveries((dl.data as Delivery[]) ?? []);
    if (pk.error) toast.error(pk.error.message); else setPickups((pk.data as PickupRequest[]) ?? []);
    if (bk.error) toast.error(bk.error.message); else setBookings((bk.data as Booking[]) ?? []);
    if (sh.error) toast.error(sh.error.message); else setShearers((sh.data as ShearerRow[]) ?? []);
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  // Quick lookup helpers
  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const stationsById = useMemo(() => Object.fromEntries(stations.map((s) => [s.id, s])), [stations]);
  const shearersById = useMemo(() => Object.fromEntries(shearers.map((s) => [s.id, s])), [shearers]);
  const lotsById = useMemo(() => Object.fromEntries(lots.map((l) => [l.id, l])), [lots]);

  if (loading) return <div className="py-20 text-center text-muted-foreground">…</div>;
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("admin")} />
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center">
          <Shield className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="font-semibold">Access denied</p>
        </div>
      </div>
    );
  }

  const pendingTotal =
    (dash?.pending?.stations ?? 0) +
    (dash?.pending?.shearers ?? 0) +
    (dash?.pending?.support ?? 0) +
    (dash?.pending?.pickups ?? 0) +
    (dash?.pending?.bookings ?? 0);

  const exportAll = async () => {
    try {
      const data = await callAdmin({ action: "export_all" });
      const obj = data as Record<string, unknown[]>;
      for (const [name, rows] of Object.entries(obj)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const cols = Object.keys(rows[0] as Record<string, unknown>);
        const csv = [
          cols.join(","),
          ...rows.map((r) => cols.map((c) => {
            const v = (r as Record<string, unknown>)[c];
            const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          }).join(",")),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `ullkollen_${name}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("Exported");
    } catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
  };

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={t("admin")} />

      {/* Header banner */}
      <div className="bg-card border border-border rounded-2xl shadow-soft p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-primary leading-tight">Admin-konsol</h2>
              <p className="text-xs text-muted-foreground">
                Full översikt av användare, ull, leveranser, stationer & support
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <Link to="/app/admin/expertkunskap"><Shield className="w-4 h-4 mr-1.5" /> Expertkunskap</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={loadAll} className="rounded-lg">
              <Activity className="w-4 h-4 mr-1.5" /> Uppdatera
            </Button>
            <Button size="sm" variant="outline" onClick={exportAll} className="rounded-lg">
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>

        {pendingTotal > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(dash?.pending?.stations ?? 0) > 0 && <PendingBadge label={`${dash!.pending.stations} stationer väntar`} onClick={() => setTab("stations")} />}
            {(dash?.pending?.shearers ?? 0) > 0 && <PendingBadge label={`${dash!.pending.shearers} klippare väntar`} onClick={() => setTab("shearers")} />}
            {(dash?.pending?.support ?? 0) > 0 && <PendingBadge label={`${dash!.pending.support} öppna ärenden`} onClick={() => setTab("support")} />}
            {(dash?.pending?.pickups ?? 0) > 0 && <PendingBadge label={`${dash!.pending.pickups} hämtningar`} onClick={() => setTab("logistics")} />}
            {(dash?.pending?.bookings ?? 0) > 0 && <PendingBadge label={`${dash!.pending.bookings} bokningar`} onClick={() => setTab("bookings")} />}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-4 h-4" /> Översikt</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Användare<Count n={users.length} /></TabsTrigger>
            <TabsTrigger value="lots" className="gap-1.5"><Package className="w-4 h-4" /> Ullpartier<Count n={lots.length} /></TabsTrigger>
            <TabsTrigger value="logistics" className="gap-1.5"><Truck className="w-4 h-4" /> Logistik<Count n={deliveries.length + pickups.length} /></TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5"><CalendarIcon className="w-4 h-4" /> Bokningar<Count n={bookings.length} /></TabsTrigger>
            <TabsTrigger value="shearers" className="gap-1.5"><Scissors className="w-4 h-4" /> Klippare<Count n={shearers.length} /></TabsTrigger>
            <TabsTrigger value="stations" className="gap-1.5"><Warehouse className="w-4 h-4" /> Stationer<Count n={stations.length} /></TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5"><Inbox className="w-4 h-4" /> Support<Count n={dash?.pending.support ?? 0} accent /></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="m-0">
          <OverviewTab dash={dash} usersById={usersById} />
        </TabsContent>
        <TabsContent value="users" className="m-0">
          <UsersTab
            users={users} details={details} setDetails={setDetails}
            onChanged={loadAll} callAdmin={callAdmin}
          />
        </TabsContent>
        <TabsContent value="lots" className="m-0">
          <LotsTab lots={lots} usersById={usersById} />
        </TabsContent>
        <TabsContent value="logistics" className="m-0">
          <LogisticsTab
            deliveries={deliveries} pickups={pickups}
            stationsById={stationsById} shearersById={shearersById}
            lotsById={lotsById} usersById={usersById}
          />
        </TabsContent>
        <TabsContent value="bookings" className="m-0">
          <BookingsTab bookings={bookings} usersById={usersById} shearersById={shearersById} />
        </TabsContent>
        <TabsContent value="shearers" className="m-0">
          <ShearersTab rows={shearers} onChanged={loadAll} usersById={usersById} />
        </TabsContent>
        <TabsContent value="stations" className="m-0">
          <StationsAdmin rows={stations} onChanged={loadAll} usersById={usersById} />
        </TabsContent>
        <TabsContent value="support" className="m-0">
          <SupportInbox rows={support} onChanged={loadAll} usersById={usersById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function Count({ n, accent }: { n: number; accent?: boolean }) {
  if (!n) return null;
  return (
    <span className={`ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${accent ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
      {n}
    </span>
  );
}

function PendingBadge({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors">
      <AlertCircle className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
        {icon}<span>{label}</span>
      </div>
      <p className="text-2xl md:text-3xl font-black text-foreground leading-none mt-2">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status, palette }: { status: string; palette?: Record<string, string> }) {
  const tone = palette?.[status] ?? "bg-muted text-muted-foreground";
  return <Badge className={`${tone} font-medium uppercase text-[10px] tracking-wider`} variant="outline">{status}</Badge>;
}

const lotPalette: Record<string, string> = {
  registered: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_transit: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  at_station: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  at_holma: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  classified: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  paid: "bg-green-600/20 text-green-700 dark:text-green-300 border-green-600/30",
};
const deliveryPalette: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};
const bookingPalette: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

function CopyChip({ value, label }: { value: string; label?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); toast.success("Kopierat"); }}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      aria-label={`Kopiera ${label ?? value}`}
    >
      <Copy className="w-3 h-3" /> <span className="truncate max-w-[14rem]">{label ?? value}</span>
    </button>
  );
}

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("sv-SE") : "—");
const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString("sv-SE") : "—");
const fmtKg = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(Number(n))} kg`);
const userLabel = (u?: AdminUser | null) => u?.full_name || u?.email || (u?.id ? u.id.slice(0, 8) : "—");

// ─── Overview tab ────────────────────────────────────────────────────────
function OverviewTab({ dash, usersById }: { dash: Dashboard | null; usersById: Record<string, AdminUser> }) {
  if (!dash) return <p className="text-center text-muted-foreground py-10">Laddar…</p>;

  const stockUtil = dash.totals.station_capacity_kg > 0
    ? Math.round((dash.totals.station_stock_kg / dash.totals.station_capacity_kg) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Användare" value={dash.totals.users}
          sub={<span><TrendingUp className="w-3 h-3 inline mr-0.5" />+{dash.growth.signups_7d} (7d) · +{dash.growth.signups_30d} (30d)</span>} />
        <StatCard icon={<Activity className="w-3.5 h-3.5" />} label="Klassningar" value={dash.totals.classifications}
          sub={<span>+{dash.growth.classifications_7d} (7d) · +{dash.growth.classifications_30d} (30d)</span>} />
        <StatCard icon={<Package className="w-3.5 h-3.5" />} label="Ullpartier" value={dash.totals.lots}
          sub={<span>{Math.round(dash.totals.lots_kg)} kg totalt · +{dash.growth.lots_7d} (7d)</span>} />
        <StatCard icon={<Truck className="w-3.5 h-3.5" />} label="Leveranser" value={dash.totals.deliveries}
          sub={<span>+{dash.growth.deliveries_7d} (7d)</span>} />
        <StatCard icon={<CalendarIcon className="w-3.5 h-3.5" />} label="Bokningar" value={dash.totals.bookings} />
        <StatCard icon={<Scissors className="w-3.5 h-3.5" />} label="Aktiva klippare" value={dash.totals.shearers} />
        <StatCard icon={<Warehouse className="w-3.5 h-3.5" />} label="Aktiva stationer" value={dash.totals.stations} />
        <StatCard icon={<Package className="w-3.5 h-3.5" />} label="Lager (kg)" value={`${dash.totals.station_stock_kg}`}
          sub={<span>{stockUtil}% av {dash.totals.station_capacity_kg} kg kapacitet</span>} accent />
      </div>

      {/* Status breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BreakdownCard title="Ullpartier per status" data={dash.lots_by_status} palette={lotPalette} />
        <BreakdownCard title="Leveranser per status" data={dash.deliveries_by_status} palette={deliveryPalette} />
        <BreakdownCard title="Bokningar per status" data={dash.bookings_by_status} palette={bookingPalette} />
      </div>

      {/* Top farms / shearers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> Topp gårdar
          </h3>
          <div className="space-y-1">
            {dash.top_farms.length === 0 && <p className="text-xs text-muted-foreground">Ingen data ännu.</p>}
            {dash.top_farms.map((f, i) => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                  <span className="font-medium truncate">{f.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{f.sheep_count} får · {f.classifications_count} kl.</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Scissors className="w-4 h-4 text-primary" /> Topp klippare
          </h3>
          <div className="space-y-1">
            {dash.top_shearers.length === 0 && <p className="text-xs text-muted-foreground">Ingen data ännu.</p>}
            {dash.top_shearers.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                  <span className="font-medium truncate">{s.display_name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{s.bookings_count} bokn. · {s.deliveries_count} lev.</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary" /> Senaste aktivitet
        </h3>
        <div className="space-y-1 max-h-96 overflow-auto">
          {dash.activity.slice(0, 50).map((a) => {
            const actor = a.actor_id ? usersById[a.actor_id] : null;
            return (
              <div key={`${a.kind}-${a.ref}`} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                <ActivityKindIcon kind={a.kind} />
                <span className="font-semibold capitalize w-20 shrink-0">{a.kind.replace("_", " ")}</span>
                <span className="flex-1 truncate">{a.title || "—"}</span>
                {actor && <span className="text-muted-foreground truncate max-w-[10rem]">{userLabel(actor)}</span>}
                <span className="text-muted-foreground shrink-0 tabular-nums">{fmtDateTime(a.ts)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActivityKindIcon({ kind }: { kind: string }) {
  const map: Record<string, ReactNode> = {
    classification: <Activity className="w-3.5 h-3.5 text-blue-500" />,
    wool_lot: <Package className="w-3.5 h-3.5 text-violet-500" />,
    delivery: <Truck className="w-3.5 h-3.5 text-amber-500" />,
    booking: <CalendarIcon className="w-3.5 h-3.5 text-emerald-500" />,
  };
  return <span className="shrink-0">{map[kind] ?? <Activity className="w-3.5 h-3.5" />}</span>;
}

function BreakdownCard({ title, data, palette }: { title: string; data: Record<string, number>; palette: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {entries.length === 0 && <p className="text-xs text-muted-foreground">Ingen data ännu.</p>}
      <div className="space-y-2">
        {entries.map(([k, n]) => {
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <div key={k}>
              <div className="flex items-center justify-between text-xs mb-1">
                <StatusBadge status={k} palette={palette} />
                <span className="tabular-nums font-semibold">{n} <span className="text-muted-foreground font-normal">({Math.round(pct)}%)</span></span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Users tab ───────────────────────────────────────────────────────────
function UsersTab({
  users, details, setDetails, onChanged, callAdmin,
}: {
  users: AdminUser[];
  details: Record<string, Detail>;
  setDetails: (fn: (d: Record<string, Detail>) => Record<string, Detail>) => void;
  onChanged: () => void;
  callAdmin: (b: Record<string, unknown>) => Promise<unknown>;
}) {
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "non_admin">("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "name" | "classifications" | "sheep">("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return users
      .filter((u) =>
        (!q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.farm_name?.toLowerCase().includes(q) || u.phone?.includes(q)) &&
        (roleFilter === "all" || (roleFilter === "admin" ? u.is_admin : !u.is_admin)),
      )
      .sort((a, b) => {
        switch (sort) {
          case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
          case "name": return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
          case "classifications": return b.classifications_count - a.classifications_count;
          case "sheep": return b.sheep_count - a.sheep_count;
          default: return +new Date(b.created_at) - +new Date(a.created_at);
        }
      });
  }, [users, filter, roleFilter, sort]);

  const openUser = async (id: string) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (!details[id]) {
      const { data, error } = await supabase.rpc("admin_user_detail", { _user_id: id });
      if (error) return toast.error(error.message);
      setDetails((d) => ({ ...d, [id]: data as Detail }));
    }
  };

  const toggleAdmin = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      if (u.is_admin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
        if (error) throw error;
      }
      toast.success("Sparat");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
    finally { setBusyId(null); }
  };

  const deleteUser = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const { data: objs } = await supabase.storage.from("sheep-photos").list(u.id, { limit: 1000 });
      if (objs?.length) {
        const allPaths: string[] = [];
        for (const obj of objs) {
          const { data: inner } = await supabase.storage.from("sheep-photos").list(`${u.id}/${obj.name}`, { limit: 1000 });
          inner?.forEach((f) => allPaths.push(`${u.id}/${obj.name}/${f.name}`));
        }
        if (allPaths.length) await supabase.storage.from("sheep-photos").remove(allPaths);
      }
      await supabase.from("classifications").delete().eq("user_id", u.id);
      await supabase.from("sheep").delete().eq("owner_id", u.id);
      await supabase.from("user_roles").delete().eq("user_id", u.id);
      await supabase.from("profiles").delete().eq("id", u.id);
      toast.success("Borttaget");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
    finally { setBusyId(null); }
  };

  const exportUser = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const data = await callAdmin({ action: "export_user", user_id: u.id });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `user_${u.email || u.id}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Sök e-post / namn / gård / telefon" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 pl-9 rounded-xl" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="w-full sm:w-40 h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla roller</SelectItem>
            <SelectItem value="admin">Endast admin</SelectItem>
            <SelectItem value="non_admin">Ej admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Senaste</SelectItem>
            <SelectItem value="oldest">Äldsta</SelectItem>
            <SelectItem value="name">Namn A→Ö</SelectItem>
            <SelectItem value="classifications">Flest klassningar</SelectItem>
            <SelectItem value="sheep">Flest får</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} av {users.length} användare</div>

      <div className="space-y-2">
        {filtered.map((u) => {
          const isOpen = openId === u.id;
          const initials = (u.full_name || u.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
          return (
            <div key={u.id} className={`bg-card border rounded-2xl shadow-soft overflow-hidden transition-colors ${isOpen ? "border-primary/40" : "border-border"}`}>
              <button onClick={() => openUser(u.id)} className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-bold shrink-0">{initials || "?"}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{u.full_name || u.email}</p>
                    {u.is_admin && <Badge className="bg-primary text-primary-foreground text-[10px] uppercase">admin</Badge>}
                  </div>
                  {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                    {u.farm_name && <span className="truncate max-w-[12rem]">🏡 {u.farm_name}</span>}
                    {u.phone && <span>📞 {u.phone}</span>}
                    <span>📅 {fmtDate(u.created_at)}</span>
                    <span>· {u.classifications_count} klass.</span>
                    <span>· {u.sheep_count} får</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-4 bg-secondary/30">
                  <UserActions user={u} busy={busyId === u.id} callAdmin={callAdmin} onChanged={onChanged} onExport={() => exportUser(u)} onToggleAdmin={() => toggleAdmin(u)} onDelete={() => deleteUser(u)} />
                  <UserDetailPanel detail={details[u.id]} />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Inga matchningar.</p>}
      </div>
    </div>
  );
}

function UserActions({
  user, busy, callAdmin, onChanged, onExport, onToggleAdmin, onDelete,
}: {
  user: AdminUser; busy: boolean;
  callAdmin: (b: Record<string, unknown>) => Promise<unknown>;
  onChanged: () => void; onExport: () => void; onToggleAdmin: () => void; onDelete: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [pwd, setPwd] = useState("");
  const [fullName, setFullName] = useState(user.full_name ?? "");

  const saveName = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) toast.error(error.message); else { toast.success("Sparat"); onChanged(); }
  };
  const updateEmail = async () => {
    if (!email || email === user.email) return;
    try { await callAdmin({ action: "update_email", user_id: user.id, email }); toast.success("E-post uppdaterad"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
  };
  const sendReset = async () => {
    try { await callAdmin({ action: "send_reset", email: user.email, redirect_to: `${window.location.origin}/auth?mode=signin` }); toast.success("Återställningsmail skickat"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
  };
  const setPassword = async () => {
    if (pwd.length < 8) return toast.error("Minst 8 tecken");
    try { await callAdmin({ action: "set_password", user_id: user.id, password: pwd }); toast.success("Lösenord satt"); setPwd(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "error"); }
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Konto</p>
          <CopyChip value={user.id} label="Kopiera user_id" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Visningsnamn</Label>
            <div className="flex gap-2"><Input className="flex-1" value={fullName} onChange={(e) => setFullName(e.target.value)} /><Button size="sm" onClick={saveName}>Spara</Button></div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Login-e-post</Label>
            <div className="flex gap-2"><Input className="flex-1" value={email} onChange={(e) => setEmail(e.target.value)} type="email" /><Button size="sm" onClick={updateEmail}><Mail className="w-4 h-4" /></Button></div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Sätt nytt lösenord</Label>
            <div className="flex flex-wrap gap-2">
              <Input className="flex-1 basis-40" value={pwd} onChange={(e) => setPwd(e.target.value)} type="text" placeholder="min 8 tecken" />
              <Button size="sm" onClick={setPassword}><KeyRound className="w-4 h-4 mr-1" /> Sätt</Button>
              <Button size="sm" variant="outline" onClick={sendReset}><Send className="w-4 h-4 mr-1" /> Återställ via mail</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" disabled={busy} onClick={onToggleAdmin}>
          {user.is_admin ? <ShieldOff className="w-4 h-4 mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
          {user.is_admin ? "Ta bort admin" : "Gör till admin"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onExport}><Download className="w-4 h-4 mr-1" /> Export JSON</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy} className="text-destructive ml-auto"><Trash2 className="w-4 h-4 mr-1" /> Radera</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Radera all användardata?</AlertDialogTitle>
              <AlertDialogDescription>Tar bort profil, får, klassningar och foton. Auth-kontot finns kvar.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">Radera</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function UserDetailPanel({ detail }: { detail: Detail | undefined }) {
  if (!detail) return <p className="text-sm text-muted-foreground">Laddar…</p>;
  const p = (detail.profile ?? {}) as Record<string, string | null>;
  const contact: Array<[string, string | null | undefined]> = [
    ["Förnamn", p.first_name], ["Efternamn", p.last_name], ["Telefon", p.phone],
    ["Adress", p.address], ["Gård", p.farm_name], ["Produktionsplatsnr", p.production_place_number],
    ["Språk", p.language],
  ];
  const hasContact = contact.some(([, v]) => v);

  return (
    <div className="space-y-3">
      {hasContact && (
        <Section title="Kontaktuppgifter">
          <div className="bg-card rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {contact.map(([label, val]) => val ? (
              <div key={label} className="flex gap-1.5 min-w-0">
                <span className="text-muted-foreground shrink-0">{label}:</span>
                <span className="font-medium truncate">{val}</span>
              </div>
            ) : null)}
          </div>
        </Section>
      )}
      <Section title={`Får (${detail.sheep.length})`}>
        <div className="space-y-1 max-h-48 overflow-auto">
          {detail.sheep.map((s) => {
            const r = s as Record<string, string | null>;
            return (
              <div key={r.id as string} className="text-xs bg-card rounded-lg px-2 py-1 flex justify-between gap-2">
                <span className="truncate">{r.ear_tag_id || r.name || (r.id as string).slice(0, 6)}</span>
                <span className="text-muted-foreground shrink-0">{breedLabel(r.breed_code, "sv")} · {r.age_category}</span>
              </div>
            );
          })}
          {detail.sheep.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
        </div>
      </Section>
      <Section title={`Klassningar (${detail.classifications.length})`}>
        <div className="space-y-1 max-h-48 overflow-auto">
          {detail.classifications.slice(0, 50).map((c) => {
            const r = c as Record<string, string | null>;
            return (
              <div key={r.id as string} className="text-xs bg-card rounded-lg px-2 py-1 flex justify-between gap-2">
                <span className="truncate">{r.wool_class ?? "—"} · {r.wool_class_name_sv ?? ""}</span>
                <span className="text-muted-foreground shrink-0">{fmtDate(r.created_at)}</span>
              </div>
            );
          })}
          {detail.classifications.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
        </div>
      </Section>
      {detail.support_messages.length > 0 && (
        <Section title={`Support (${detail.support_messages.length})`}>
          <div className="space-y-1 max-h-32 overflow-auto">
            {detail.support_messages.map((m) => {
              const r = m as Record<string, string | null>;
              return <div key={r.id as string} className="text-xs bg-card rounded-lg px-2 py-1"><span className="font-semibold">{r.subject}</span> · {r.status}</div>;
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
      {children}
    </div>
  );
}

// ─── Lots tab ────────────────────────────────────────────────────────────
function LotsTab({ lots, usersById }: { lots: WoolLot[]; usersById: Record<string, AdminUser> }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return lots.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      const owner = usersById[l.owner_id];
      return l.id.includes(q) || (l.notes || "").toLowerCase().includes(q) || (owner?.full_name || "").toLowerCase().includes(q) || (owner?.email || "").toLowerCase().includes(q);
    });
  }, [lots, filter, statusFilter, usersById]);

  const statuses = ["registered", "in_transit", "at_station", "at_holma", "classified", "paid"];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Sök ID / ägare / anteckning" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 pl-9 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla status</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="text-xs text-muted-foreground">{filtered.length} av {lots.length} partier</div>
      <div className="space-y-2">
        {filtered.map((l) => (
          <div key={l.id} className="bg-card border border-border rounded-xl p-3 shadow-soft">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={l.status} palette={lotPalette} />
                  <span className="font-semibold tabular-nums">{fmtKg(l.actual_kg ?? l.estimated_kg)}</span>
                  {l.actual_kg != null && l.estimated_kg != null && (
                    <span className="text-[11px] text-muted-foreground">est. {fmtKg(l.estimated_kg)}</span>
                  )}
                  {l.breed_codes && l.breed_codes.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{l.breed_codes.map((c) => breedLabel(c, "sv")).join(", ")}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Ägare: <span className="font-medium text-foreground">{userLabel(usersById[l.owner_id])}</span>
                  {l.notes && <span> · {l.notes}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{fmtDate(l.created_at)}</span>
                <CopyChip value={l.id} label={l.id.slice(0, 8)} />
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Inga partier.</p>}
      </div>
    </div>
  );
}

// ─── Logistics (deliveries + pickups) ────────────────────────────────────
function LogisticsTab({
  deliveries, pickups, stationsById, shearersById, lotsById, usersById,
}: {
  deliveries: Delivery[]; pickups: PickupRequest[];
  stationsById: Record<string, Station>; shearersById: Record<string, ShearerRow>;
  lotsById: Record<string, WoolLot>; usersById: Record<string, AdminUser>;
}) {
  const [view, setView] = useState<"deliveries" | "pickups">("deliveries");

  return (
    <div className="space-y-3">
      <div className="inline-flex p-1 bg-secondary rounded-xl gap-1">
        <button onClick={() => setView("deliveries")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === "deliveries" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          Leveranser ({deliveries.length})
        </button>
        <button onClick={() => setView("pickups")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${view === "pickups" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          Hämtningar ({pickups.length})
        </button>
      </div>

      {view === "deliveries" && (
        <div className="space-y-2">
          {deliveries.map((d) => {
            const lot = lotsById[d.wool_lot_id];
            const owner = lot ? usersById[lot.owner_id] : null;
            const dest = d.destination_station_id ? stationsById[d.destination_station_id] : null;
            const origin = d.origin_station_id ? stationsById[d.origin_station_id] : null;
            const shearer = d.shearer_id ? shearersById[d.shearer_id] : null;
            return (
              <div key={d.id} className="bg-card border border-border rounded-xl p-3 shadow-soft">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={d.status} palette={deliveryPalette} />
                    <Badge variant="outline" className="text-[10px] uppercase">{d.method}</Badge>
                    {d.scheduled_for && <span className="text-xs text-muted-foreground">📅 {fmtDate(d.scheduled_for)}</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{fmtDateTime(d.created_at)}</span>
                </div>
                <div className="mt-2 text-xs space-y-0.5">
                  <p>📦 Parti: <span className="font-medium">{lot ? fmtKg(lot.actual_kg ?? lot.estimated_kg) : "—"}</span> · Ägare: <span className="font-medium">{userLabel(owner)}</span></p>
                  {(origin || dest) && <p className="text-muted-foreground">{origin ? origin.name : "—"} → {dest ? dest.name : "—"}</p>}
                  {shearer && <p className="text-muted-foreground">🚐 Klippare: {shearer.display_name}</p>}
                  {(d.distance_km != null || d.mileage_sek != null) && (
                    <p className="text-muted-foreground">
                      {d.distance_km != null && <span>{Math.round(d.distance_km)} km</span>}
                      {d.distance_km != null && d.mileage_sek != null && " · "}
                      {d.mileage_sek != null && <span>{Math.round(d.mileage_sek)} kr milersättning</span>}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {deliveries.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Inga leveranser.</p>}
        </div>
      )}

      {view === "pickups" && (
        <div className="space-y-2">
          {pickups.map((p) => {
            const station = p.station_id ? stationsById[p.station_id] : null;
            const owner = p.owner_id ? usersById[p.owner_id] : null;
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-3 shadow-soft">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.status} palette={deliveryPalette} />
                    <Badge variant="outline" className={`text-[10px] uppercase ${p.priority === "high" ? "border-destructive text-destructive" : ""}`}>{p.priority}</Badge>
                    <span className="font-semibold text-sm tabular-nums">{Math.round(p.requested_kg)} kg</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{fmtDateTime(p.created_at)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                  {station && <p>🏚 Station: <span className="text-foreground font-medium">{station.name}</span></p>}
                  {owner && <p>👤 Bonde: <span className="text-foreground font-medium">{userLabel(owner)}</span></p>}
                  {p.scheduled_for && <p>📅 Planerad: {fmtDate(p.scheduled_for)}</p>}
                  {p.notes && <p className="italic">"{p.notes}"</p>}
                </div>
              </div>
            );
          })}
          {pickups.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Inga hämtningsförfrågningar.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Bookings ────────────────────────────────────────────────────────────
function BookingsTab({ bookings, usersById, shearersById }: { bookings: Booking[]; usersById: Record<string, AdminUser>; shearersById: Record<string, ShearerRow> }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(() => bookings.filter((b) => statusFilter === "all" || b.status === statusFilter), [bookings, statusFilter]);

  return (
    <div className="space-y-3">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla status</SelectItem>
          <SelectItem value="pending">pending</SelectItem>
          <SelectItem value="confirmed">confirmed</SelectItem>
          <SelectItem value="completed">completed</SelectItem>
          <SelectItem value="cancelled">cancelled</SelectItem>
        </SelectContent>
      </Select>
      <div className="text-xs text-muted-foreground">{filtered.length} av {bookings.length} bokningar</div>
      <div className="space-y-2">
        {filtered.map((b) => {
          const farmer = usersById[b.farmer_id];
          const shearer = shearersById[b.shearer_id];
          return (
            <div key={b.id} className="bg-card border border-border rounded-xl p-3 shadow-soft">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={b.status} palette={bookingPalette} />
                  {b.preferred_date && <span className="text-xs text-muted-foreground">📅 {fmtDate(b.preferred_date)}</span>}
                  {b.sheep_count != null && <span className="text-xs text-muted-foreground">🐑 {b.sheep_count} st</span>}
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtDateTime(b.created_at)}</span>
              </div>
              <div className="mt-1 text-xs space-y-0.5">
                <p>👤 Bonde: <span className="font-medium">{userLabel(farmer)}</span> {b.contact_phone && <span className="text-muted-foreground">· 📞 {b.contact_phone}</span>}</p>
                <p>✂ Klippare: <span className="font-medium">{shearer?.display_name ?? "—"}</span></p>
                {b.message && <p className="italic text-muted-foreground">"{b.message}"</p>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">Inga bokningar.</p>}
      </div>
    </div>
  );
}

// ─── Shearers ────────────────────────────────────────────────────────────
function ShearersTab({ rows, onChanged, usersById }: { rows: ShearerRow[]; onChanged: () => void; usersById: Record<string, AdminUser> }) {
  const setApproved = async (id: string, approved: boolean) => {
    const { error } = await supabase.from("shearers").update({ approved }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(approved ? "Godkänd" : "Återkallad"); onChanged(); }
  };
  const setActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("shearers").update({ active }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(active ? "Aktiv" : "Inaktiv"); onChanged(); }
  };

  const pending = rows.filter((s) => !s.approved);
  const approved = rows.filter((s) => s.approved);

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Väntar på godkännande ({pending.length})</h3>
          {pending.map((s) => <ShearerRowCard key={s.id} s={s} owner={s.user_id ? usersById[s.user_id] : null} onApprove={() => setApproved(s.id, true)} onReject={() => setApproved(s.id, false)} onActive={(a) => setActive(s.id, a)} />)}
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Godkända klippare ({approved.length})</h3>
        {approved.length === 0 && <p className="text-sm text-muted-foreground">Inga godkända klippare ännu.</p>}
        {approved.map((s) => <ShearerRowCard key={s.id} s={s} owner={s.user_id ? usersById[s.user_id] : null} onApprove={() => setApproved(s.id, true)} onReject={() => setApproved(s.id, false)} onActive={(a) => setActive(s.id, a)} />)}
      </section>
    </div>
  );
}

function ShearerRowCard({ s, owner, onApprove, onReject, onActive }: { s: ShearerRow; owner: AdminUser | null; onApprove: () => void; onReject: () => void; onActive: (a: boolean) => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="font-semibold flex items-center gap-2 flex-wrap">
            {s.display_name}
            {s.certified_by_farklipparforbundet && <Badge variant="outline" className="text-[10px]">Fårklipparförbundet</Badge>}
            {s.listed_by_faravelsforbundet && <Badge variant="outline" className="text-[10px]">Fåravelsförbundet</Badge>}
            {s.collects_wool && <Badge variant="outline" className="text-[10px]">Hämtar ull</Badge>}
            {s.has_trailer && <Badge variant="outline" className="text-[10px]">Släp</Badge>}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
            {s.phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{s.phone}</span>}
            {s.email && <span><Mail className="w-3 h-3 inline mr-0.5" />{s.email}</span>}
            {s.hourly_rate_sek != null && <span>{s.hourly_rate_sek} kr/tim</span>}
            {s.wool_capacity_kg > 0 && <span>kapacitet {s.wool_capacity_kg} kg</span>}
            {owner && <span>· konto: {userLabel(owner)}</span>}
            <span>· {fmtDate(s.created_at)}</span>
          </div>
          {(s.service_areas?.length || s.breed_specialties?.length || s.languages?.length) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {s.service_areas?.map((a) => <Badge key={`a-${a}`} variant="secondary" className="text-[10px]"><MapPin className="w-3 h-3 mr-0.5" />{a}</Badge>)}
              {s.breed_specialties?.map((a) => <Badge key={`b-${a}`} variant="secondary" className="text-[10px]">🐑 {a}</Badge>)}
              {s.languages?.map((a) => <Badge key={`l-${a}`} variant="secondary" className="text-[10px]">🗣 {a}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!s.approved ? (
            <>
              <Button size="sm" onClick={onApprove}><Check className="w-4 h-4 mr-1" /> Godkänn</Button>
              <Button size="sm" variant="outline" onClick={onReject}><X className="w-4 h-4" /></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant={s.active ? "outline" : "default"} onClick={() => onActive(!s.active)}>{s.active ? "Inaktivera" : "Aktivera"}</Button>
              <Button size="sm" variant="outline" onClick={onReject}>Återkalla</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stations ────────────────────────────────────────────────────────────
function StationsAdmin({ rows, onChanged, usersById }: { rows: Station[]; onChanged: () => void; usersById: Record<string, AdminUser> }) {
  const setApproved = async (id: string, approved: boolean) => {
    const { error } = await supabase.from("collection_stations").update({ approved }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(approved ? "Godkänd" : "Återkallad"); onChanged(); }
  };
  const setActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("collection_stations").update({ active }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(active ? "Aktiv" : "Inaktiv"); onChanged(); }
  };

  const pending = rows.filter((s) => !s.approved);
  const approved = rows.filter((s) => s.approved);

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Väntar på godkännande ({pending.length})</h3>
          {pending.map((s) => <StationRow key={s.id} s={s} manager={s.manager_user_id ? usersById[s.manager_user_id] : null} onApprove={() => setApproved(s.id, true)} onReject={() => setApproved(s.id, false)} onActive={(a) => setActive(s.id, a)} />)}
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Godkända stationer ({approved.length})</h3>
        {approved.length === 0 && <p className="text-sm text-muted-foreground">Inga godkända stationer ännu.</p>}
        {approved.map((s) => <StationRow key={s.id} s={s} manager={s.manager_user_id ? usersById[s.manager_user_id] : null} onApprove={() => setApproved(s.id, true)} onReject={() => setApproved(s.id, false)} onActive={(a) => setActive(s.id, a)} />)}
      </section>
    </div>
  );
}

function StationRow({ s, manager, onApprove, onReject, onActive }: { s: Station; manager: AdminUser | null; onApprove: () => void; onReject: () => void; onActive: (a: boolean) => void }) {
  const util = s.capacity_kg > 0 ? Math.round((s.current_stock_kg / s.capacity_kg) * 100) : 0;
  const utilTone = util >= 90 ? "text-destructive" : util >= 70 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{s.name}</p>
            {!s.active && <Badge variant="outline" className="text-[10px] uppercase border-muted">Inaktiv</Badge>}
          </div>
          {s.address && <p className="text-xs text-muted-foreground">📍 {s.address}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
            {s.contact_phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{s.contact_phone}</span>}
            {s.contact_email && <span><Mail className="w-3 h-3 inline mr-0.5" />{s.contact_email}</span>}
            {manager && <span>👤 {userLabel(manager)}</span>}
            <span>{fmtDate(s.created_at)}</span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Lager</span>
              <span className={`font-semibold tabular-nums ${utilTone}`}>{s.current_stock_kg}/{s.capacity_kg} kg ({util}%)</span>
            </div>
            <Progress value={util} className="h-1.5" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!s.approved ? (
            <>
              <Button size="sm" onClick={onApprove}><Check className="w-4 h-4 mr-1" /> Godkänn</Button>
              <Button size="sm" variant="outline" onClick={onReject}><X className="w-4 h-4" /></Button>
            </>
          ) : (
            <>
              <Button size="sm" variant={s.active ? "outline" : "default"} onClick={() => onActive(!s.active)}>{s.active ? "Inaktivera" : "Aktivera"}</Button>
              <Button size="sm" variant="outline" onClick={onReject}>Återkalla</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Support ─────────────────────────────────────────────────────────────
function SupportInbox({ rows, onChanged, usersById }: { rows: SupportRow[]; onChanged: () => void; usersById: Record<string, AdminUser> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const update = async (id: string, patch: Partial<SupportRow>) => {
    const { error } = await supabase.from("support_messages").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Uppdaterat"); onChanged(); }
  };

  const filtered = rows.filter((m) => statusFilter === "all" || m.status === statusFilter);

  return (
    <div className="space-y-3">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla status</SelectItem>
          <SelectItem value="open">Öppna</SelectItem>
          <SelectItem value="resolved">Lösta</SelectItem>
        </SelectContent>
      </Select>
      <div className="text-xs text-muted-foreground">{filtered.length} av {rows.length} ärenden</div>
      {filtered.length === 0 ? <p className="text-center text-muted-foreground py-10 text-sm">Inga ärenden.</p> : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const u = m.user_id ? usersById[m.user_id] : null;
            return (
              <div key={m.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-2">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{m.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{u ? userLabel(u) : (m.email || "Anonym")} {m.email && u && <span>· {m.email}</span>}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${m.status === "open" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"} text-[10px] uppercase font-bold`}>{m.status}</Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                {m.admin_notes && (
                  <div className="text-sm bg-primary/10 rounded-lg p-2 whitespace-pre-wrap">
                    <p className="text-xs font-semibold text-primary mb-1">Svar</p>
                    {m.admin_notes}
                  </div>
                )}
                {editing === m.id ? (
                  <div className="space-y-2">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Svar / anteckningar" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { update(m.id, { admin_notes: reply, status: "resolved" }); setEditing(null); setReply(""); }}>Spara & lös</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Avbryt</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(m.id); setReply(m.admin_notes ?? ""); }}>Svara</Button>
                    {m.status === "open"
                      ? <Button size="sm" variant="outline" onClick={() => update(m.id, { status: "resolved" })}>Markera löst</Button>
                      : <Button size="sm" variant="outline" onClick={() => update(m.id, { status: "open" })}>Öppna igen</Button>}
                    <span className="text-[11px] text-muted-foreground self-center ml-auto">{fmtDateTime(m.created_at)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
