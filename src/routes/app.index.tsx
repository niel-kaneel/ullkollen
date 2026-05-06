import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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
  const { user, profile, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = () => {
    if (!user) return;
    supabase
      .from("classifications")
      .select("id, created_at, wool_class, wool_class_name_sv, recommendation_text_sv, status, photo_urls")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  };

  useEffect(load, [user]);

  const remove = async (row: Row) => {
    if (row.photo_urls?.length) {
      await supabase.storage.from("sheep-photos").remove(row.photo_urls);
    }
    const { error } = await supabase.from("classifications").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted"));
    setRows((r) => r.filter((x) => x.id !== row.id));
  };

  return (
    <div className="space-y-6">
      <div className="pt-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-primary">
            {lang === "sv" ? "Hej" : "Hi"}
            {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h2>
          {profile?.farm_name && <p className="text-muted-foreground">{profile.farm_name}</p>}
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/app/admin">{t("admin")}</Link>
          </Button>
        )}
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
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            aria-label={t("delete")}
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
