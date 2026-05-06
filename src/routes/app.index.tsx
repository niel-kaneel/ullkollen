import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase, SUPABASE_PROJECT_URL } from "@/lib/supabase";

type Row = {
  id: string;
  created_at: string;
  wool_class: string | null;
  wool_class_name_sv: string | null;
  recommendation_text_sv: string | null;
  status: string;
  photo_urls: string[];
};

export const Route = createFileRoute("/app/")({
  component: Home,
});

function Home() {
  const { t, lang } = useTranslation();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("classifications")
      .select("id, created_at, wool_class, wool_class_name_sv, recommendation_text_sv, status, photo_urls")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-primary">
          {lang === "sv" ? "Hej" : "Hi"}
          {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
        </h2>
        {profile?.farm_name && <p className="text-muted-foreground">{profile.farm_name}</p>}
      </div>

      <Button asChild size="lg" className="w-full h-20 text-lg rounded-3xl bg-primary hover:bg-primary/90 shadow-card">
        <Link to="/app/classify">
          <Plus className="w-6 h-6 mr-2" strokeWidth={3} />
          {t("newClassification")}
        </Link>
      </Button>

      <div>
        <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("recent")}</h3>
        {rows.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-2 text-accent opacity-60" />
            <p className="text-sm">{t("noClassificationsYet")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <ClassRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassRow({ row }: { row: Row }) {
  const { t } = useTranslation();
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const first = row.photo_urls?.[0];
    if (!first) return;
    // photo_urls store object paths; create signed URL
    supabase.storage.from("sheep-photos").createSignedUrl(first, 3600).then(({ data }) => {
      if (data?.signedUrl) setThumb(data.signedUrl);
    });
  }, [row.photo_urls]);

  return (
    <Link to="/app/result/$id" params={{ id: row.id }} className="block bg-card border border-border rounded-2xl p-3 shadow-soft active:scale-[0.99] transition">
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
          {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🐑</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {row.wool_class && (
              <span className="inline-block bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-md">
                {row.wool_class}
              </span>
            )}
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
  );
}
