import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type Sheep = { id: string; name: string | null; tag_id: string | null; breed: string | null; age_category: string | null; created_at: string };

export const Route = createFileRoute("/app/flock")({
  component: Flock,
});

function Flock() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [sheep, setSheep] = useState<Sheep[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("sheep")
      .select("id, name, tag_id, breed, age_category, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSheep((data as Sheep[]) ?? []));
  }, [user]);

  return (
    <div className="space-y-3 pt-2">
      <h2 className="text-xl font-bold text-primary">{t("flock")}</h2>
      {sheep.length === 0 ? (
        <p className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground text-sm">
          {lang === "sv" ? "Sparade får visas här efter en klassificering." : "Saved sheep appear here after a classification."}
        </p>
      ) : (
        sheep.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-2xl p-4 shadow-soft">
            <div className="flex justify-between">
              <p className="font-semibold">{s.name || s.tag_id || `🐑 ${s.id.slice(0, 6)}`}</p>
              <span className="text-xs text-muted-foreground">{s.age_category}</span>
            </div>
            <p className="text-sm text-muted-foreground">{s.breed}</p>
          </div>
        ))
      )}
    </div>
  );
}
