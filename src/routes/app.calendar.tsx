import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Phone, Sparkles, User as UserIcon, CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { checkBookingConflict, conflictMessage } from "@/lib/booking-conflicts";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  status: string;
  role: "farmer" | "shearer"; // current user's role for this booking
  farmer_id: string;
  shearer_id: string;
  sheep_count: number | null;
  message: string | null;
  contact_phone: string | null;
  counterparty: string;
  sheep_name: string | null;
  expected_class_code: string | null;
  expected_class_name: string | null;
  expected_confidence: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500",
  accepted: "bg-primary",
  declined: "bg-red-500",
  cancelled: "bg-muted-foreground",
  completed: "bg-emerald-600",
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarPage() {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(ymd(new Date()));
  const [reschedule, setReschedule] = useState<{ id: string; date: string; farmerId: string; shearerId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const handleReschedule = async () => {
    if (!reschedule) return;
    setSaving(true);

    const conflict = await checkBookingConflict({
      date: reschedule.date,
      farmerId: reschedule.farmerId,
      shearerId: reschedule.shearerId,
      excludeBookingId: reschedule.id,
    });
    if (conflict.hasConflict) {
      setSaving(false);
      toast.error(conflictMessage(conflict, lang as "sv" | "en") ?? "");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ preferred_date: reschedule.date, status: "pending" })
      .eq("id", reschedule.id);
    setSaving(false);
    if (error) {
      toast.error(lang === "sv" ? "Kunde inte uppdatera" : "Could not update");
      return;
    }
    toast.success(lang === "sv" ? "Bokning ombokad" : "Booking rescheduled");
    setSelectedDate(reschedule.date);
    setReschedule(null);
    setReloadTick((t) => t + 1);
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);

      // Outgoing (as farmer)
      const { data: out } = await supabase
        .from("bookings")
        .select("*, shearer:shearers(display_name), sheep:sheep(name, ear_tag_id)")
        .eq("farmer_id", user.id);

      // Incoming (as shearer)
      const { data: myShearer } = await supabase.from("shearers").select("id").eq("user_id", user.id).maybeSingle();
      let inc: any[] = [];
      if (myShearer) {
        const { data } = await supabase
          .from("bookings")
          .select("*, sheep:sheep(name, ear_tag_id)")
          .eq("shearer_id", myShearer.id);
        inc = data ?? [];
        const farmerIds = [...new Set(inc.map((b) => b.farmer_id))];
        if (farmerIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, farm_name")
            .in("id", farmerIds);
          const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
          inc.forEach((b) => (b._farmer = map.get(b.farmer_id)));
        }
      }

      const all: CalEvent[] = [];
      (out ?? []).forEach((b: any) => {
        if (!b.preferred_date) return;
        all.push({
          id: b.id,
          date: b.preferred_date,
          status: b.status,
          role: "farmer",
          farmer_id: b.farmer_id,
          shearer_id: b.shearer_id,
          sheep_count: b.sheep_count,
          message: b.message,
          contact_phone: b.contact_phone,
          counterparty: b.shearer?.display_name ?? (lang === "sv" ? "Klippare" : "Shearer"),
          sheep_name: b.sheep?.name || b.sheep?.ear_tag_id || null,
          expected_class_code: b.expected_wool_class,
          expected_class_name: lang === "sv" ? b.expected_wool_class_name_sv : b.expected_wool_class_name_en,
          expected_confidence: b.expected_confidence,
        });
      });
      inc.forEach((b: any) => {
        if (!b.preferred_date) return;
        all.push({
          id: b.id,
          date: b.preferred_date,
          status: b.status,
          role: "shearer",
          farmer_id: b.farmer_id,
          shearer_id: b.shearer_id,
          sheep_count: b.sheep_count,
          message: b.message,
          contact_phone: b.contact_phone,
          counterparty: b._farmer?.farm_name || b._farmer?.full_name || (lang === "sv" ? "Bonde" : "Farmer"),
          sheep_name: b.sheep?.name || b.sheep?.ear_tag_id || null,
          expected_class_code: b.expected_wool_class,
          expected_class_name: lang === "sv" ? b.expected_wool_class_name_sv : b.expected_wool_class_name_en,
          expected_confidence: b.expected_confidence,
        });
      });
      setEvents(all);
      setLoading(false);
    };
    load();
  }, [user?.id, lang, reloadTick]);

  const monthLabel = useMemo(
    () => cursor.toLocaleDateString(lang === "sv" ? "sv-SE" : "en-US", { month: "long", year: "numeric" }),
    [cursor, lang],
  );

  const weeks = useMemo(() => {
    const first = new Date(cursor);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach((e) => {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    });
    return m;
  }, [events]);

  const dayLabels = lang === "sv"
    ? ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const todayStr = ymd(new Date());
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  return (
    <div className="space-y-4 pb-8 pt-2">
      <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
        <CalendarIcon className="w-6 h-6" />
        {lang === "sv" ? "Min kalender" : "My calendar"}
      </h2>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-semibold capitalize">{monthLabel}</div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground uppercase mb-1">
          {dayLabels.map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.map((d) => {
            const ds = ymd(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const dayEvents = eventsByDate.get(ds) ?? [];
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDate;
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-start p-1 text-xs transition ${
                  isSelected ? "bg-primary text-primary-foreground" : inMonth ? "bg-background" : "bg-transparent text-muted-foreground/50"
                } ${isToday && !isSelected ? "ring-1 ring-primary" : ""}`}
              >
                <span className={`leading-tight ${isToday ? "font-bold" : ""}`}>{d.getDate()}</span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[e.status] ?? "bg-primary"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
          {new Date(selectedDate + "T00:00:00").toLocaleDateString(lang === "sv" ? "sv-SE" : "en-US", {
            weekday: "long", day: "numeric", month: "long",
          })}
        </h3>
        {loading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lang === "sv" ? "Inga klippningar denna dag." : "No shearings this day."}
          </p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((e) => (
              <div key={e.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                      {e.role === "shearer"
                        ? (lang === "sv" ? "Bonde" : "Farmer")
                        : (lang === "sv" ? "Klippare" : "Shearer")}
                    </p>
                    <p className="font-bold flex items-center gap-1.5"><UserIcon className="w-4 h-4 text-primary" />{e.counterparty}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${STATUS_COLOR[e.status] ?? "bg-primary"}`}>
                    {e.status}
                  </span>
                </div>
                {e.sheep_name && (
                  <p className="text-sm">🐑 {e.sheep_name}</p>
                )}
                {e.sheep_count != null && (
                  <p className="text-sm">{lang === "sv" ? "Antal får" : "Sheep count"}: <span className="font-semibold">{e.sheep_count}</span></p>
                )}
                {e.expected_class_code && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-sm flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-primary">
                        {lang === "sv" ? "Förväntad ullkvalitet (AI)" : "Expected wool quality (AI)"}
                      </p>
                      <p className="font-semibold">
                        {e.expected_class_code}{e.expected_class_name ? ` — ${e.expected_class_name}` : ""}
                      </p>
                      {e.expected_confidence && (
                        <p className="text-[11px] text-muted-foreground">
                          {lang === "sv" ? "Säkerhet" : "Confidence"}: {e.expected_confidence}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {e.message && <p className="text-sm italic text-muted-foreground">"{e.message}"</p>}
                {e.contact_phone && (
                  <a href={`tel:${e.contact_phone}`} className="text-sm text-primary underline inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {e.contact_phone}
                  </a>
                )}
                {e.status !== "cancelled" && e.status !== "completed" && (
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReschedule({ id: e.id, date: e.date })}
                      className="w-full"
                    >
                      <CalendarClock className="w-4 h-4" />
                      {lang === "sv" ? "Boka om / ändra tid" : "Reschedule"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Link to="/app/bookings" className="text-sm text-primary underline inline-block mt-4">
          {lang === "sv" ? "Visa alla bokningar" : "View all bookings"}
        </Link>
      </div>

      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "sv" ? "Boka om klippning" : "Reschedule shearing"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-date">{lang === "sv" ? "Nytt datum" : "New date"}</Label>
            <Input
              id="new-date"
              type="date"
              value={reschedule?.date ?? ""}
              min={ymd(new Date())}
              onChange={(e) => setReschedule((r) => (r ? { ...r, date: e.target.value } : r))}
            />
            <p className="text-xs text-muted-foreground">
              {lang === "sv"
                ? "Status sätts till väntande tills motparten bekräftar."
                : "Status will be set to pending until the other party confirms."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)} disabled={saving}>
              {lang === "sv" ? "Avbryt" : "Cancel"}
            </Button>
            <Button onClick={handleReschedule} disabled={saving || !reschedule?.date}>
              {saving ? (lang === "sv" ? "Sparar…" : "Saving…") : (lang === "sv" ? "Spara" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
