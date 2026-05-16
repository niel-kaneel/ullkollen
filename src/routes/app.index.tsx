import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Trash2, Calendar, Bell, Camera, Package, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { OnboardingTour } from "@/components/OnboardingTour";
import { haptic } from "@/lib/haptics";

type Row = {
  id: string;
  created_at: string;
  wool_class: string | null;
  wool_class_name_sv: string | null;
  recommendation_text_sv: string | null;
  status: string;
  photo_urls: string[];
  shear_recommendation: string | null;
  mode: string | null;
};

type ModeFilter = "all" | "on_sheep" | "sheared";

export const Route = createFileRoute("/app/")({
  component: Home,
});

function Home() {
  const { t, lang } = useTranslation();
  const { user, profile, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingBookings, setPendingBookings] = useState(0);
  const [isShearer, setIsShearer] = useState(false);
  const [stationStatus, setStationStatus] = useState<"none" | "pending" | "approved">("none");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  const load = async () => {
    if (!user) return;
    const [{ data: classRows }, { data: bookingRows }, { data: shearerRow }, { data: stationRow }] = await Promise.all([
      supabase
        .from("classifications")
        .select("id, created_at, wool_class, wool_class_name_sv, recommendation_text_sv, status, photo_urls, shear_recommendation, mode")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: false })
        .eq("farmer_id", user.id)
        .in("status", ["pending", "accepted"]),
      supabase
        .from("shearers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("collection_stations")
        .select("id, approved")
        .eq("manager_user_id", user.id)
        .maybeSingle(),
    ]);
    setRows((classRows as Row[]) ?? []);
    setPendingBookings(bookingRows?.length ?? 0);
    setIsShearer(!!shearerRow);
    setStationStatus(
      stationRow ? ((stationRow as { approved: boolean }).approved ? "approved" : "pending") : "none",
    );
    setLoaded(true);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { pull, refreshing, threshold } = usePullToRefresh({
    onRefresh: async () => {
      haptic("tap");
      await load();
    },
  });

  // Påminnelse: räkna klassningar med rekommendation att klippa nu/snart
  const reminders = useMemo(() => {
    return rows.filter((r) =>
      r.mode !== "sheared" &&
      (r.shear_recommendation === "shear_now" || r.shear_recommendation === "shear_urgent"),
    );
  }, [rows]);

  const remove = async (row: Row) => {
    if (row.photo_urls?.length) {
      await supabase.storage.from("sheep-photos").remove(row.photo_urls);
    }
    const { error } = await supabase.from("classifications").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    haptic("success");
    toast.success(t("deleted"));
    setRows((r) => r.filter((x) => x.id !== row.id));
  };

  return (
    <div className="space-y-6">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} threshold={threshold} />
      <OnboardingTour />

      <div className="pt-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
            {new Date().toLocaleDateString(lang === "sv" ? "sv-SE" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="font-display text-3xl font-bold text-primary mt-1">
            {lang === "sv" ? "Hej" : "Hi"}
            {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h2>
          {profile?.farm_name && (
            <p className="text-sm text-muted-foreground mt-0.5">🌾 {profile.farm_name}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full bg-card">
              <Link to="/app/holma">Holma</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full bg-card">
              <Link to="/app/admin">{t("admin")}</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Påminnelse-banner: får som behöver klippas */}
      {reminders.length > 0 && (
        <div className="bg-accent/15 border border-accent/40 rounded-2xl p-4 flex items-start gap-3">
          <div className="bg-accent text-accent-foreground rounded-full p-2 flex-shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {t({ sv: `${reminders.length} ${reminders.length === 1 ? "får är" : "får är"} redo att klippas`, en: `${reminders.length} ${reminders.length === 1 ? "sheep is" : "sheep are"} ready to shear` })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t({ sv: "Hitta en klippare nu så hinner du.", en: "Find a shearer now to be in time." })}
            </p>
            <Button asChild size="sm" className="mt-3 rounded-xl">
              <Link to="/app/shearers" onClick={() => haptic("tap")}>
                {t({ sv: "Hitta klippare", en: "Find shearer" })}
              </Link>
            </Button>
          </div>
        </div>
      )}

      <Button
        asChild
        size="lg"
        className="w-full h-20 text-lg rounded-3xl shadow-card text-primary-foreground"
        style={{ background: "var(--gradient-pine)" }}
        onClick={() => haptic("tap")}
      >
        <Link to="/app/classify">
          <Plus className="w-6 h-6 mr-2" strokeWidth={3} />
          {t("newClassification")}
        </Link>
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="outline" className="h-14 rounded-2xl text-sm">
          <Link to="/app/bookings">
            <Calendar className="w-4 h-4 mr-1.5" />
            {lang === "sv" ? "Bokningar" : "Bookings"}
            {pendingBookings > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                {pendingBookings}
              </span>
            )}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 rounded-2xl text-sm">
          <Link to="/app/sell">
            <Package className="w-4 h-4 mr-1.5" />
            {t({ sv: "Sälj ull", en: "Sell wool" })}
          </Link>
        </Button>
      </div>

      {isShearer && (
        <Button asChild variant="outline" className="w-full h-14 rounded-2xl text-sm">
          <Link to="/app/shearer-hub">
            <Truck className="w-4 h-4 mr-1.5" />
            {t({ sv: "Klipparhub – insamling & intäkter", en: "Shearer hub – collection & earnings" })}
          </Link>
        </Button>
      )}

      <Button asChild variant="outline" className="w-full h-14 rounded-2xl text-sm">
        <Link to="/app/station">
          <Warehouse className="w-4 h-4 mr-1.5" />
          {stationStatus === "approved"
            ? (t({ sv: "Min insamlingsstation", en: "My collection station" }))
            : stationStatus === "pending"
            ? (t({ sv: "Stationsansökan – väntar", en: "Station application – pending" }))
            : (t({ sv: "Driv en insamlingsstation", en: "Run a collection station" }))}
        </Link>
      </Button>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.25em]">
            {t("recent")}
          </h3>
          {rows.length > 0 && (
            <span className="text-[11px] font-semibold text-muted-foreground">
              {rows.filter((r) => modeFilter === "all" || r.mode === modeFilter).length}/{rows.length}
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <div className="flex gap-2 mb-3">
            {([
              { v: "all", label: lang === "sv" ? "Alla" : "All" },
              { v: "on_sheep", label: t({ sv: "🐑 På fåret", en: "🐑 On sheep" })},
              { v: "sheared", label: t({ sv: "🧶 Klippt", en: "🧶 Sheared" })},
            ] as const).map((p) => (
              <button
                key={p.v}
                onClick={() => setModeFilter(p.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  modeFilter === p.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-secondary/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {!loaded ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-soft">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-accent" />
            <p className="text-sm text-muted-foreground mb-5">{t("noClassificationsYet")}</p>
            <Button
              asChild
              size="lg"
              className="rounded-2xl"
              style={{ background: "var(--gradient-pine)" }}
              onClick={() => haptic("tap")}
            >
              <Link to="/app/classify">
                <Camera className="w-5 h-5 mr-2" />
                {t({ sv: "Klassa din första tacka", en: "Classify your first ewe" })}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows
              .filter((r) => modeFilter === "all" || r.mode === modeFilter)
              .map((r) => (
                <ClassRow key={r.id} row={r} onDelete={() => remove(r)} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassRow({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const { t } = useTranslation();
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const first = row.photo_urls?.[0];
    if (!first) return;
    supabase.storage.from("sheep-photos").createSignedUrl(first, 3600).then(({ data }) => {
      if (data?.signedUrl) setThumb(data.signedUrl);
    });
  }, [row.photo_urls]);

  return (
    <div className="relative bg-card border border-border rounded-2xl shadow-soft">
      <Link to="/app/result/$id" params={{ id: row.id }} className="block p-3 active:scale-[0.99] transition pr-12">
        <div className="flex gap-3">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🐑</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {row.wool_class && (
                <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-md">
                  {row.wool_class}
                </span>
              )}
              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                {row.mode === "sheared" ? "🧶" : "🐑"}
              </span>
              {row.status === "processing" && (
                <span className="text-xs text-accent">{t("analyzing")}</span>
              )}
            </div>
            <p className="text-sm font-medium mt-1 line-clamp-1">{row.wool_class_name_sv ?? "—"}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{row.recommendation_text_sv ?? ""}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{new Date(row.created_at).toLocaleString("sv-SE")}</p>
          </div>
        </div>
      </Link>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            aria-label={t("delete")}
            onClick={() => haptic("warning")}
            className="absolute top-2 right-2 p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}?</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
