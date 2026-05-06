import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Scissors, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Classification = {
  id: string;
  status: string;
  wool_class: string | null;
  wool_class_name_sv: string | null;
  wool_class_name_en: string | null;
  confidence: string | null;
  shear_recommendation: string | null;
  weeks_until_optimal: number | null;
  recommendation_text_sv: string | null;
  recommendation_text_en: string | null;
  reasoning_sv: string | null;
  photo_urls: string[];
  breed: string | null;
  age_category: string | null;
  needs_retake: boolean | null;
  retake_reason_sv: string | null;
  sheep_id: string | null;
};

export const Route = createFileRoute("/app/result/$id")({
  component: Result,
});

function Result() {
  const { id } = Route.useParams();
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Classification | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: row } = await supabase.from("classifications").select("*").eq("id", id).maybeSingle();
      if (cancelled || !row) return;
      setData(row as Classification);
      if (row.status === "completed" || row.status === "failed") setPolling(false);
      // signed urls
      if (row.photo_urls?.length) {
        const signed = await Promise.all(
          row.photo_urls.map((p: string) => supabase.storage.from("sheep-photos").createSignedUrl(p, 3600)),
        );
        setPhotos(signed.map((s) => s.data?.signedUrl).filter(Boolean) as string[]);
      }
    };
    load();
    const iv = polling ? setInterval(load, 2500) : null;
    return () => { cancelled = true; if (iv) clearInterval(iv); };
  }, [id, polling]);

  const saveToFlock = async () => {
    if (!user || !data) return;
    const { data: sheep, error } = await supabase
      .from("sheep")
      .insert({
        owner_id: user.id,
        breed: data.breed,
        age_category: data.age_category,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await supabase.from("classifications").update({ sheep_id: sheep.id }).eq("id", id);
    toast.success(t("saved"));
  };

  if (!data) {
    return <div className="py-20 text-center text-muted-foreground">...</div>;
  }

  const recText = lang === "sv" ? data.recommendation_text_sv : data.recommendation_text_en;
  const className = lang === "sv" ? data.wool_class_name_sv : data.wool_class_name_en;

  if (data.status !== "completed") {
    return (
      <div className="py-16 flex flex-col items-center text-center gap-4">
        <div className="text-6xl animate-pulse">🐑</div>
        <p className="text-lg font-medium text-primary">{t("analyzing")}</p>
        {data.status === "failed" && <p className="text-destructive">{t("error")}</p>}
      </div>
    );
  }

  const recColor =
    data.shear_recommendation === "shear_now" || data.shear_recommendation === "shear_urgent"
      ? "bg-accent text-accent-foreground"
      : data.shear_recommendation === "do_not_shear_lambing"
      ? "bg-destructive text-destructive-foreground"
      : "bg-primary text-primary-foreground";

  return (
    <div className="space-y-5 pb-4">
      <Link to="/app" className="inline-flex items-center gap-2 text-muted-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> {t("back")}
      </Link>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {photos.map((p, i) => (
            <img key={i} src={p} alt="" className="h-32 w-32 object-cover rounded-2xl flex-shrink-0" />
          ))}
        </div>
      )}

      {data.needs_retake || !data.wool_class ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
          <p className="font-semibold text-destructive">{lang === "sv" ? "Behöver bättre bilder" : "Needs better photos"}</p>
          <p className="text-sm mt-2">{data.retake_reason_sv ?? data.reasoning_sv}</p>
          <Button onClick={() => navigate({ to: "/app/classify" })} className="mt-4 w-full h-12 rounded-xl">
            {t("newClassification")}
          </Button>
        </div>
      ) : (
        <>
          <div className="text-center bg-card rounded-3xl p-6 shadow-card border border-border">
            <div className="inline-block bg-primary text-primary-foreground text-4xl font-black px-6 py-3 rounded-2xl tracking-wider">
              {data.wool_class}
            </div>
            <h2 className="text-lg font-semibold mt-3">{className}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("confidence")}:{" "}
              <span className="font-medium">
                {data.confidence === "high" ? t("high") : data.confidence === "medium" ? t("medium") : t("low")}
              </span>
            </p>
          </div>

          <div className={`rounded-2xl p-5 ${recColor}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("recommendation")}</p>
            <p className="text-lg font-bold mt-1">{recText}</p>
          </div>

          {data.reasoning_sv && lang === "sv" && (
            <div className="bg-secondary/60 rounded-2xl p-4 text-sm">
              {data.reasoning_sv}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button asChild size="lg" className="h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link to="/app/shearers">
                <Scissors className="w-5 h-5 mr-1" />
                {t("bookShearer")}
              </Link>
            </Button>
            <Button onClick={saveToFlock} size="lg" variant="outline" className="h-14 rounded-2xl border-2">
              <Sheet className="w-5 h-5 mr-1" />
              {t("saveToFlock")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
