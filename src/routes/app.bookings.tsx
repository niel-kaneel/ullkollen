import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Phone, MessageSquare, CheckCircle2, XCircle, Clock, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { haptic } from "@/lib/haptics";

type Booking = {
  id: string;
  farmer_id: string;
  shearer_id: string;
  preferred_date: string | null;
  message: string | null;
  sheep_count: number | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
  shearer?: { display_name: string; phone: string | null } | null;
  farmer?: { full_name: string | null; farm_name: string | null; phone: string | null } | null;
};

export const Route = createFileRoute("/app/bookings")({
  component: BookingsPage,
});

function BookingsPage() {
  const { user } = useAuth();
  const [outgoing, setOutgoing] = useState<Booking[]>([]);
  const [incoming, setIncoming] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Bookings I made (as farmer)
    const { data: out } = await supabase
      .from("bookings")
      .select("*, shearer:shearers(display_name, phone)")
      .eq("farmer_id", user.id)
      .order("created_at", { ascending: false });
    setOutgoing((out as any) ?? []);

    // Bookings to me (as shearer)
    const { data: myShearer } = await supabase.from("shearers").select("id").eq("user_id", user.id).maybeSingle();
    if (myShearer) {
      const { data: inc } = await supabase
        .from("bookings")
        .select("*")
        .eq("shearer_id", myShearer.id)
        .order("created_at", { ascending: false });
      const list = (inc as Booking[]) ?? [];
      const farmerIds = [...new Set(list.map((b) => b.farmer_id))];
      if (farmerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, farm_name, phone")
          .in("id", farmerIds);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        list.forEach((b) => (b.farmer = map.get(b.farmer_id) ?? null));
      }
      setIncoming(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const { pull, refreshing, threshold } = usePullToRefresh({
    onRefresh: async () => { haptic("tap"); await load(); },
  });

  const respond = async (id: string, status: "accepted" | "declined") => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { haptic("error"); toast.error(error.message); }
    else {
      haptic("success");
      toast.success(status === "accepted" ? "Bokning accepterad" : "Bokning avböjd");
      load();
    }
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { haptic("error"); toast.error(error.message); }
    else { haptic("success"); toast.success("Bokning avbokad"); load(); }
  };

  return (
    <div className="space-y-5 pb-8 pt-2">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} threshold={threshold} />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Mina bokningar</h2>
        <Link to="/app/calendar" className="text-sm text-primary underline inline-flex items-center gap-1">
          <CalendarDays className="w-4 h-4" /> Kalender
        </Link>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      )}

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">Inkommande bokningar</h3>
          {incoming.map((b) => (
            <div key={b.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{b.farmer?.farm_name || b.farmer?.full_name || "Bonde"}</p>
                  {b.farmer?.full_name && b.farmer?.farm_name && (
                    <p className="text-xs text-muted-foreground">{b.farmer.full_name}</p>
                  )}
                </div>
                <StatusBadge status={b.status} />
              </div>
              {b.preferred_date && (
                <p className="text-sm flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary" />{b.preferred_date}</p>
              )}
              {b.sheep_count != null && <p className="text-sm">🐑 {b.sheep_count} får</p>}
              {b.message && <p className="text-sm italic text-muted-foreground">"{b.message}"</p>}
              {(b.contact_phone || b.farmer?.phone) && (
                <a href={`tel:${b.contact_phone || b.farmer?.phone}`} className="text-sm text-primary underline inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {b.contact_phone || b.farmer?.phone}
                </a>
              )}
              {b.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => respond(b.id, "accepted")} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Acceptera
                  </button>
                  <button onClick={() => respond(b.id, "declined")} className="flex-1 bg-secondary text-secondary-foreground rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1">
                    <XCircle className="w-4 h-4" /> Avböj
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase">Mina bokningar till klippare</h3>
        {!loading && outgoing.length === 0 && (
          <p className="text-sm text-muted-foreground">Du har inga bokningar ännu. Hitta en klippare under "Klippare".</p>
        )}
        {outgoing.map((b) => (
          <div key={b.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft space-y-2">
            <div className="flex justify-between items-start">
              <p className="font-bold text-primary">{b.shearer?.display_name ?? "Klippare"}</p>
              <StatusBadge status={b.status} />
            </div>
            {b.preferred_date && (
              <p className="text-sm flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary" />{b.preferred_date}</p>
            )}
            {b.sheep_count != null && <p className="text-sm">🐑 {b.sheep_count} får</p>}
            {b.message && <p className="text-sm italic text-muted-foreground">"{b.message}"</p>}
            {b.shearer?.phone && b.status === "accepted" && (
              <a href={`tel:${b.shearer.phone}`} className="text-sm text-primary underline inline-flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {b.shearer.phone}
              </a>
            )}
            {b.status === "pending" && (
              <button onClick={() => cancel(b.id)} className="text-xs text-destructive underline mt-1">Avboka</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "Väntar", cls: "bg-yellow-100 text-yellow-900", icon: Clock },
    accepted: { label: "Accepterad", cls: "bg-green-100 text-green-900", icon: CheckCircle2 },
    declined: { label: "Avböjd", cls: "bg-red-100 text-red-900", icon: XCircle },
    cancelled: { label: "Avbokad", cls: "bg-secondary text-secondary-foreground", icon: XCircle },
    completed: { label: "Klar", cls: "bg-primary/10 text-primary", icon: CheckCircle2 },
  };
  const s = map[status] ?? map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}
