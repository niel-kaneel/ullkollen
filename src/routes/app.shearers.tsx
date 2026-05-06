import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, MessageSquare, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type Shearer = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  languages: string[];
  breed_specialties: string[];
  hourly_rate_sek: number | null;
  distance_km?: number;
};

export const Route = createFileRoute("/app/shearers")({
  component: Shearers,
});

function Shearers() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [list, setList] = useState<Shearer[]>([]);

  useEffect(() => {
    const load = async () => {
      if (profile?.home_lat && profile?.home_lng) {
        const { data, error } = await supabase.rpc("nearest_shearers", {
          user_lat: profile.home_lat,
          user_lng: profile.home_lng,
          max_km: 500,
          max_results: 30,
        });
        if (!error && data) {
          setList(data as Shearer[]);
          return;
        }
      }
      // fallback: list all approved
      const { data } = await supabase
        .from("shearers")
        .select("id, display_name, phone, email, languages, breed_specialties, hourly_rate_sek")
        .eq("approved", true)
        .eq("active", true);
      setList((data as Shearer[]) ?? []);
    };
    load();
  }, [profile]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-primary pt-2">{t("shearersNearYou")}</h2>
      {!profile?.home_lat && (
        <p className="text-sm text-muted-foreground bg-secondary/60 rounded-xl p-3 flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{t("updateLocation")} → {t("profile")}</span>
        </p>
      )}
      {list.map((s) => <ShearerCard key={s.id} s={s} />)}
      {list.length === 0 && (
        <p className="text-center text-muted-foreground py-10">—</p>
      )}
    </div>
  );
}

function ShearerCard({ s }: { s: Shearer }) {
  const { t } = useTranslation();
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-bold text-lg text-primary">{s.display_name}</h3>
          {s.distance_km != null && (
            <p className="text-sm text-muted-foreground">
              {Math.round(s.distance_km)} {t("kmAway")}
            </p>
          )}
        </div>
        {s.hourly_rate_sek && (
          <span className="bg-secondary text-xs font-medium px-2 py-1 rounded-md">{s.hourly_rate_sek} kr/h</span>
        )}
      </div>

      {s.breed_specialties?.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          <span className="font-semibold">{t("specializesIn")}:</span> {s.breed_specialties.join(", ")}
        </p>
      )}
      {s.languages?.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">{t("languagesLabel")}:</span> {s.languages.join(", ").toUpperCase()}
        </p>
      )}

      <div className="flex gap-2 mt-3">
        {s.phone && (
          <>
            <a href={`tel:${s.phone}`} className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1">
              <Phone className="w-4 h-4" /> {t("call")}
            </a>
            <a href={`sms:${s.phone}`} className="flex-1 bg-secondary text-secondary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1">
              <MessageSquare className="w-4 h-4" /> {t("sms")}
            </a>
          </>
        )}
        {s.email && (
          <a href={`mailto:${s.email}`} className="flex-1 bg-accent text-accent-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1">
            <Mail className="w-4 h-4" /> {t("emailAction")}
          </a>
        )}
      </div>
    </div>
  );
}
