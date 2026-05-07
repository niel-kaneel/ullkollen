import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Phone, MessageSquare, Mail, Globe, MapPin, X, Info, ChevronRight, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Shearer = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  languages: string[] | null;
  service_areas: string[] | null;
  certified_by_farklipparforbundet: boolean | null;
  listed_by_faravelsforbundet: boolean | null;
  self_managed: boolean | null;
  notes: string | null;
  distance_km?: number | null;
};

type Filter = "all" | "certified" | "near50" | "near100";

const FLAGS: Record<string, string> = { sv: "🇸🇪", en: "🇬🇧", no: "🇳🇴", de: "🇩🇪", fi: "🇫🇮", it: "🇮🇹" };

export const Route = createFileRoute("/app/shearers")({
  component: ShearersPage,
});

function ShearersPage() {
  const { profile } = useAuth();
  const [list, setList] = useState<Shearer[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<Shearer | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [hasLocation, setHasLocation] = useState<boolean>(!!(profile?.home_lat && profile?.home_lng));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (profile?.home_lat && profile?.home_lng) {
        const { data, error } = await supabase.rpc("nearest_shearers", {
          user_lat: profile.home_lat,
          user_lng: profile.home_lng,
          max_km: 9999,
          max_results: 200,
        });
        if (!error && data) {
          setList(data as Shearer[]);
          setHasLocation(true);
          setLoading(false);
          return;
        }
      }
      setHasLocation(false);
      const { data } = await supabase
        .from("shearers")
        .select("id, display_name, phone, email, website, languages, service_areas, certified_by_farklipparforbundet, listed_by_faravelsforbundet, self_managed, notes")
        .eq("approved", true)
        .eq("active", true)
        .order("display_name");
      setList((data as Shearer[]) ?? []);
      setLoading(false);
    };
    load();
  }, [profile?.home_lat, profile?.home_lng]);

  const filtered = useMemo(() => {
    if (filter === "certified") return list.filter((s) => s.certified_by_farklipparforbundet);
    if (filter === "near50") return list.filter((s) => s.distance_km != null && s.distance_km < 50);
    if (filter === "near100") return list.filter((s) => s.distance_km != null && s.distance_km < 100);
    return list;
  }, [list, filter]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation stöds inte");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!profile) return;
        const { error } = await supabase
          .from("profiles")
          .update({ home_lat: pos.coords.latitude, home_lng: pos.coords.longitude })
          .eq("id", profile.id);
        if (error) {
          toast.error("Kunde inte spara plats");
        } else {
          toast.success("Plats sparad");
          window.location.reload();
        }
      },
      () => toast.error("Plats nekad"),
    );
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-primary">Hitta fårklippare</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {list.length} klippare i Sverige{hasLocation ? " • Sorterat efter avstånd" : " • A–Ö"}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <FilterPill label="Alla" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterPill label="Certifierade" active={filter === "certified"} onClick={() => setFilter("certified")} />
        {hasLocation && (
          <>
            <FilterPill label="Inom 50 km" active={filter === "near50"} onClick={() => setFilter("near50")} />
            <FilterPill label="Inom 100 km" active={filter === "near100"} onClick={() => setFilter("near100")} />
          </>
        )}
      </div>

      {!hasLocation && !loading && (
        <div className="bg-secondary/60 border border-border rounded-2xl p-4">
          <p className="text-sm font-medium flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Aktivera plats för att se närmaste klippare</span>
          </p>
          <button
            onClick={requestLocation}
            className="mt-3 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Aktivera plats
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            Visar alla klippare i bokstavsordning. Aktivera plats för avståndssortering.
          </p>
        </div>
      )}

      {filtered.map((s) => (
        <ShearerCard key={s.id} s={s} onTap={() => setActive(s)} />
      ))}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-10 text-sm">
          Inga klippare matchar din sökning. Prova ett bredare filter eller se hela listan.
        </p>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 shadow-soft mt-6">
        <p className="text-sm">
          Är du fårklippare?{" "}
          <Link to="/auth" search={{ role: "shearer" } as any} className="font-semibold text-primary underline">
            Skapa ett konto
          </Link>{" "}
          för att hantera din egen profil ›
        </p>
      </div>

      <button
        onClick={() => setShowAbout(true)}
        className="w-full text-center text-xs text-muted-foreground underline pt-4 flex items-center justify-center gap-1"
      >
        <Info className="w-3 h-3" /> Om klipparlistan
      </button>

      {active && <DetailModal s={active} onClose={() => setActive(null)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-secondary/50"
      }`}
    >
      {label}
    </button>
  );
}

function Badges({ s }: { s: Shearer }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {s.certified_by_farklipparforbundet && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
          🟢 Certifierad
        </span>
      )}
      {s.listed_by_faravelsforbundet && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
          🔵 Listad
        </span>
      )}
      {s.self_managed && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
          ⚪ Egen profil
        </span>
      )}
    </div>
  );
}

function ShearerCard({ s, onTap }: { s: Shearer; onTap: () => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
      <button onClick={onTap} className="w-full text-left">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-lg text-primary leading-tight">{s.display_name}</h3>
          {s.distance_km != null && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1 flex-shrink-0">
              <MapPin className="w-3 h-3" /> {Math.round(s.distance_km)} km bort
            </span>
          )}
        </div>
        <Badges s={s} />
        {s.service_areas && s.service_areas.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">{s.service_areas.join(" • ")}</p>
        )}
        {s.languages && s.languages.length > 0 && (
          <p className="text-sm mt-1">{s.languages.map((l) => FLAGS[l] ?? "").join(" ")}</p>
        )}
      </button>

      <div className="flex flex-wrap gap-2 mt-3">
        {s.phone && (
          <>
            <a href={`tel:${s.phone}`} className="flex-1 min-w-[80px] bg-primary text-primary-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Ring
            </a>
            <a href={`sms:${s.phone}`} className="flex-1 min-w-[80px] bg-secondary text-secondary-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> SMS
            </a>
          </>
        )}
        {s.email && (
          <a href={`mailto:${s.email}`} className="flex-1 min-w-[80px] bg-accent text-accent-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1">
            <Mail className="w-3.5 h-3.5" /> E-post
          </a>
        )}
        {s.website && (
          <a href={s.website} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[80px] bg-secondary text-secondary-foreground rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1">
            <Globe className="w-3.5 h-3.5" /> Hemsida
          </a>
        )}
      </div>
    </div>
  );
}

function DetailModal({ s, onClose }: { s: Shearer; onClose: () => void }) {
  const source = s.certified_by_farklipparforbundet
    ? "Källa: Svenska Fårklipparförbundet"
    : s.listed_by_faravelsforbundet
    ? "Källa: Svenska Fåravelsförbundet"
    : s.self_managed
    ? "Profil hanterad av klipparen"
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-primary">{s.display_name}</h3>
            {s.distance_km != null && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {Math.round(s.distance_km)} km bort
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Badges s={s} />

          {s.service_areas && s.service_areas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Område</p>
              <p className="text-sm">{s.service_areas.join(" • ")}</p>
            </div>
          )}

          {s.languages && s.languages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Språk</p>
              <p className="text-base">{s.languages.map((l) => FLAGS[l] ?? l).join(" ")}</p>
            </div>
          )}

          {s.notes && <p className="italic text-sm text-muted-foreground">{s.notes}</p>}

          <div className="space-y-2 border-t border-border pt-4">
            {s.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-primary" />
                <a href={`tel:${s.phone}`} className="underline">{s.phone}</a>
              </div>
            )}
            {s.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-primary" />
                <a href={`mailto:${s.email}`} className="underline break-all">{s.email}</a>
              </div>
            )}
            {s.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-primary" />
                <a href={s.website} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {s.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {s.phone && (
              <>
                <a href={`tel:${s.phone}`} className="flex-1 min-w-[100px] bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5">
                  <Phone className="w-4 h-4" /> Ring
                </a>
                <a href={`sms:${s.phone}`} className="flex-1 min-w-[100px] bg-secondary text-secondary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-4 h-4" /> SMS
                </a>
              </>
            )}
            {s.email && (
              <a href={`mailto:${s.email}`} className="flex-1 min-w-[100px] bg-accent text-accent-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5">
                <Mail className="w-4 h-4" /> E-post
              </a>
            )}
            {s.website && (
              <a href={s.website} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[100px] bg-secondary text-secondary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5">
                <Globe className="w-4 h-4" /> Hemsida
              </a>
            )}
          </div>

          <button
            onClick={() => toast.info("Bokningsfunktion kommer snart")}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            Boka via Ullkollen <ChevronRight className="w-4 h-4" />
          </button>

          {source && <p className="text-[11px] text-muted-foreground text-center pt-2">{source}</p>}
        </div>
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-background rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-primary">Om klipparlistan</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 text-sm leading-relaxed">
          <p className="font-semibold">Var kommer klipparlistan ifrån?</p>
          <p>Ullkollens klipparlista är sammanställd från två källor:</p>
          <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
            <p>🟢 <strong>Svenska Fårklipparförbundet</strong> — våra "Certifierade" klippare har genomgått förbundets utbildning och är medlemmar.</p>
            <a href="https://farklipparforbundet.se/" target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
              Besök farklipparforbundet.se
            </a>
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
            <p>🔵 <strong>Svenska Fåravelsförbundet</strong> — våra "Listade" klippare finns med på SFs öppna klipparlista.</p>
            <a href="https://faravelsforbundet.se/farklippare/" target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
              Besök faravelsforbundet.se/farklippare
            </a>
          </div>
          <p className="text-muted-foreground">
            Klippare som upptäcker fel i sin profil kan kontakta oss eller skapa ett eget konto för att hantera profilen själva.
          </p>
        </div>
      </div>
    </div>
  );
}
