import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scissors, Sheet, Trash2, Pencil, Check, X, ChevronDown, Share2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { BackButton } from "@/components/BackButton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

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
  mode: string;
  body_area: string | null;
  fleece_id: string | null;
  shearing_date: string | null;
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Classification>>({});
  const [saving, setSaving] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const onShare = async () => {
    if (!data) return;
    haptic("tap");
    const className = lang === "sv" ? data.wool_class_name_sv : data.wool_class_name_en;
    const recText = lang === "sv" ? data.recommendation_text_sv : data.recommendation_text_en;
    const text = [
      `🐑 Ullkollen — ${data.wool_class ?? "?"}${className ? ` (${className})` : ""}`,
      data.breed ? `Ras: ${data.breed}` : null,
      recText ? `Rekommendation: ${recText}` : null,
      "",
      "Klassificerat med Ullkollen",
    ].filter(Boolean).join("\n");
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ullkollen", text, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success(lang === "sv" ? "Kopierat till urklipp" : "Copied to clipboard");
      }
    } catch {
      // användaren avbröt, ingen åtgärd
    }
  };


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

  const remove = async () => {
    // Best-effort: delete photos from storage, then row.
    if (data?.photo_urls?.length) {
      await supabase.storage.from("sheep-photos").remove(data.photo_urls);
    }
    const { error } = await supabase.from("classifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted"));
    navigate({ to: "/app" });
  };

  const startEdit = () => {
    if (!data) return;
    setDraft({
      wool_class: data.wool_class,
      wool_class_name_sv: data.wool_class_name_sv,
      wool_class_name_en: data.wool_class_name_en,
      confidence: data.confidence,
      shear_recommendation: data.shear_recommendation,
      recommendation_text_sv: data.recommendation_text_sv,
      recommendation_text_en: data.recommendation_text_en,
      reasoning_sv: data.reasoning_sv,
    });
    setEditing(true);
    setPolling(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
  };

  const saveEdit = async () => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase.from("classifications").update(draft).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setData({ ...data, ...draft } as Classification);
    setEditing(false);
    toast.success(lang === "sv" ? "Sparat" : "Saved");
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="py-20 text-center text-muted-foreground">...</div>
      </div>
    );
  }

  const recText = lang === "sv" ? data.recommendation_text_sv : data.recommendation_text_en;
  const className = lang === "sv" ? data.wool_class_name_sv : data.wool_class_name_en;

  if (data.status !== "completed") {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="py-16 flex flex-col items-center text-center gap-4">
          <div className="text-6xl animate-pulse">🐑</div>
          <p className="text-lg font-medium text-primary">{t("analyzing")}</p>
          {data.status === "failed" && <p className="text-destructive">{t("error")}</p>}
        </div>
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
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex items-center gap-1">
          {!editing && data.status === "completed" && data.wool_class && (
            <>
              <Button variant="ghost" size="sm" onClick={onShare} aria-label={lang === "sv" ? "Dela" : "Share"}>
                <Share2 className="w-4 h-4 mr-1" /> {lang === "sv" ? "Dela" : "Share"}
              </Button>
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-1" /> {lang === "sv" ? "Redigera" : "Edit"}
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> {t("cancel")}
              </Button>
              <Button size="sm" onClick={() => { haptic("success"); saveEdit(); }} disabled={saving}>
                <Check className="w-4 h-4 mr-1" /> {saving ? "..." : (lang === "sv" ? "Spara" : "Save")}
              </Button>
            </>
          )}
          {!editing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 mr-1" /> {t("delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("delete")}?</AlertDialogTitle>
                  <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {t("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

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
      ) : editing ? (
        <div className="space-y-4 bg-card rounded-3xl p-5 border border-border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wc">{lang === "sv" ? "Klass" : "Class"}</Label>
              <Input id="wc" value={draft.wool_class ?? ""} onChange={(e) => setDraft({ ...draft, wool_class: e.target.value })} />
            </div>
            <div>
              <Label>{t("confidence")}</Label>
              <Select value={draft.confidence ?? ""} onValueChange={(v) => setDraft({ ...draft, confidence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t("high")}</SelectItem>
                  <SelectItem value="medium">{t("medium")}</SelectItem>
                  <SelectItem value="low">{t("low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="cn">{lang === "sv" ? "Klassnamn (SV)" : "Class name (SV)"}</Label>
            <Input id="cn" value={draft.wool_class_name_sv ?? ""} onChange={(e) => setDraft({ ...draft, wool_class_name_sv: e.target.value })} />
          </div>
          <div>
            <Label>{t("recommendation")}</Label>
            <Select value={draft.shear_recommendation ?? ""} onValueChange={(v) => setDraft({ ...draft, shear_recommendation: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shear_now">shear_now</SelectItem>
                <SelectItem value="shear_urgent">shear_urgent</SelectItem>
                <SelectItem value="wait">wait</SelectItem>
                <SelectItem value="do_not_shear_lambing">do_not_shear_lambing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rt">{lang === "sv" ? "Rekommendationstext" : "Recommendation text"}</Label>
            <Textarea id="rt" rows={2} value={(lang === "sv" ? draft.recommendation_text_sv : draft.recommendation_text_en) ?? ""}
              onChange={(e) => setDraft({ ...draft, [lang === "sv" ? "recommendation_text_sv" : "recommendation_text_en"]: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="rs">{lang === "sv" ? "Motivering" : "Reasoning"}</Label>
            <Textarea id="rs" rows={4} value={draft.reasoning_sv ?? ""} onChange={(e) => setDraft({ ...draft, reasoning_sv: e.target.value })} />
          </div>
        </div>
      ) : (
        <>
          <div className="text-center bg-card rounded-3xl p-6 shadow-card border border-border">
            <div className="inline-block bg-primary text-primary-foreground text-4xl font-black px-6 py-3 rounded-2xl tracking-wider">
              {data.wool_class}
            </div>
            <h2 className="text-lg font-semibold mt-3">{className}</h2>
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  data.confidence === "high"
                    ? "bg-emerald-500"
                    : data.confidence === "medium"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-muted-foreground">{t("confidence")}:</span>
              <span className="font-semibold">
                {data.confidence === "high" ? t("high") : data.confidence === "medium" ? t("medium") : t("low")}
              </span>
            </div>
          </div>

          <div className={`rounded-2xl p-5 ${recColor}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("recommendation")}</p>
            <p className="text-lg font-bold mt-1">{recText}</p>
          </div>

          {data.reasoning_sv && lang === "sv" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => { haptic("select"); setShowReasoning((v) => !v); }}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/50 transition"
                aria-expanded={showReasoning}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Info className="w-4 h-4 text-primary" />
                  {lang === "sv" ? "Varför denna klass?" : "Why this class?"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${showReasoning ? "rotate-180" : ""}`}
                />
              </button>
              {showReasoning && (
                <div className="px-4 pb-4 text-sm text-foreground/85 leading-relaxed border-t border-border pt-3">
                  {data.reasoning_sv}
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    {lang === "sv"
                      ? "Tycker du klassen är fel? Tryck på Redigera ovan för att korrigera."
                      : "Think the class is wrong? Tap Edit above to correct it."}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button asChild size="lg" className="h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => haptic("tap")}>
              <Link to="/app/shearers">
                <Scissors className="w-5 h-5 mr-1" />
                {t("bookShearer")}
              </Link>
            </Button>
            <Button onClick={() => { haptic("success"); saveToFlock(); }} size="lg" variant="outline" className="h-14 rounded-2xl border-2">
              <Sheet className="w-5 h-5 mr-1" />
              {t("saveToFlock")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
