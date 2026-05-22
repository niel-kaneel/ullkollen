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
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { haptic } from "@/lib/haptics";
import { PaymentBreakdownCard } from "@/components/PaymentBreakdownCard";
import { TactileSelfCheck } from "@/components/TactileSelfCheck";
import { getClassRange, isOutOfRangeCorrection } from "@/lib/wool-classes";

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
  user_confirmed: boolean;
  original_wool_class: string | null;
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
  const [showRangeInfo, setShowRangeInfo] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [linkedSheep, setLinkedSheep] = useState<{ name: string | null; ear_tag_id: string | null } | null>(null);

  const onShare = async () => {
    if (!data) return;
    haptic("tap");
    const className = t({ sv: data.wool_class_name_sv, en: data.wool_class_name_en });
    const recText = t({ sv: data.recommendation_text_sv, en: data.recommendation_text_en });
    const text = [
      `🐑 Ullkollen — ${data.wool_class ?? "?"}${className ? ` (${className})` : ""}`,
      data.breed ? `${t("breedLabel")}: ${data.breed}` : null,
      recText ? `${t("recommendationLabel")}: ${recText}` : null,
      "",
      t("classifiedWith"),
    ].filter(Boolean).join("\n");
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ullkollen", text, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success(t({ sv: "Kopierat till urklipp", en: "Copied to clipboard" }));
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
      if (row.sheep_id) {
        const { data: sheepRow } = await supabase.from("sheep").select("name, ear_tag_id").eq("id", row.sheep_id).maybeSingle();
        if (!cancelled) setLinkedSheep(sheepRow as { name: string | null; ear_tag_id: string | null } | null);
      } else {
        setLinkedSheep(null);
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
    // Editing the class counts as a confirmed correction → feeds AI learning
    const payload: Partial<Classification> = {
      ...draft,
      user_confirmed: true,
    };
    const { error } = await supabase
      .from("classifications")
      .update({ ...payload, confirmed_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setData({ ...data, ...payload } as Classification);
    setEditing(false);
    const wasCorrection = draft.wool_class && draft.wool_class !== data.original_wool_class;
    toast.success(wasCorrection
      ? (t({ sv: "Korrigering sparad — AI:n lär sig", en: "Correction saved — AI is learning" }))
      : (t({ sv: "Sparat", en: "Saved" })));
  };

  const confirmClass = async () => {
    if (!data) return;
    haptic("success");
    const { error } = await supabase
      .from("classifications")
      .update({ user_confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setData({ ...data, user_confirmed: true });
    toast.success(t({ sv: "Tack! AI:n blir bättre med varje bekräftelse", en: "Thanks! AI improves with every confirmation" }));
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("analyzing")} />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    );
  }

  const rawRecText = t({ sv: data.recommendation_text_sv, en: data.recommendation_text_en });
  // Safety net: if the wool is already sheared, never display a "shear now / wait to shear" suggestion.
  const looksLikeShearAdvice = !!rawRecText && /\b(klipp|shear)/i.test(rawRecText);
  const recText = data.mode === "sheared" && looksLikeShearAdvice
    ? (t({ sv: `Sortera som ${data.wool_class ?? "klassad"} och leverera till uppsamlingsstation.`, en: `Sort as ${data.wool_class ?? "classified"} and deliver to a collection station.` }))
    : rawRecText;
  const className = t({ sv: data.wool_class_name_sv, en: data.wool_class_name_en });

  if (data.status !== "completed") {
    return (
      <div className="space-y-4">
        <PageHeader title={t("analyzing")} />
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
      <PageHeader
        title={className || (t({ sv: "Resultat", en: "Result" }))}
        action={
          <div className="flex items-center gap-1">
          {!editing && data.status === "completed" && data.wool_class && (
            <>
              <Button variant="ghost" size="sm" onClick={onShare} aria-label={t({ sv: "Dela", en: "Share" })}>
                <Share2 className="w-4 h-4 mr-1" /> {t({ sv: "Dela", en: "Share" })}
              </Button>
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-1" /> {t({ sv: "Redigera", en: "Edit" })}
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> {t("cancel")}
              </Button>
              <Button size="sm" onClick={() => { haptic("success"); saveEdit(); }} disabled={saving}>
                <Check className="w-4 h-4 mr-1" /> {saving ? "..." : (t({ sv: "Spara", en: "Save" }))}
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
        }
      />

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { haptic("tap"); setLightbox(i); }}
              className="h-32 w-32 rounded-2xl flex-shrink-0 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={t({ sv: "Förstora bild", en: "Zoom photo" })}
            >
              <img src={p} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
            aria-label={t({ sv: "Stäng", en: "Close" })}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={photos[lightbox]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full object-contain rounded-xl"
          />
          {photos.length > 1 && (
            <div className="mt-4 flex items-center gap-3 text-white text-sm" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLightbox((i) => (i === null ? 0 : (i - 1 + photos.length) % photos.length))}
                className="px-3 py-1.5 rounded-full bg-white/15"
              >
                ‹
              </button>
              <span>{lightbox + 1} / {photos.length}</span>
              <button
                type="button"
                onClick={() => setLightbox((i) => (i === null ? 0 : (i + 1) % photos.length))}
                className="px-3 py-1.5 rounded-full bg-white/15"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
          {data.mode === "sheared" ? "🧶" : "🐑"}
          {data.mode === "sheared"
            ? (t({ sv: "Klippt ull", en: "Sheared" }))
            : (t({ sv: "På fåret", en: "On sheep" }))}
        </span>
        {data.mode === "on_sheep" && data.body_area && (
          <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-secondary/60 text-muted-foreground">
            {data.body_area}
          </span>
        )}
        {data.mode === "sheared" && data.fleece_id && (
          <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-secondary/60 text-muted-foreground">
            ID: {data.fleece_id}
          </span>
        )}
        {data.mode === "sheared" && data.shearing_date && (
          <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-secondary/60 text-muted-foreground">
            {new Date(data.shearing_date + "T00:00:00").toLocaleDateString(lang === "sv" ? "sv-SE" : "en-GB")}
          </span>
        )}
        {linkedSheep && (
          <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full bg-secondary/60 text-muted-foreground">
            {linkedSheep.name ?? linkedSheep.ear_tag_id ?? t({ sv: "Får", en: "Sheep" })}
          </span>
        )}
      </div>

      {data.needs_retake || !data.wool_class ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
          <p className="font-semibold text-destructive">{t({ sv: "Behöver bättre bilder", en: "Needs better photos" })}</p>
          <p className="text-sm mt-2">{data.retake_reason_sv ?? data.reasoning_sv}</p>
          <Button onClick={() => navigate({ to: "/app/classify" })} className="mt-4 w-full h-12 rounded-xl">
            {t("newClassification")}
          </Button>
        </div>
      ) : editing ? (
        <div className="space-y-4 bg-card rounded-3xl p-5 border border-border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wc">{t({ sv: "Klass", en: "Class" })}</Label>
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
            <Label htmlFor="cn">{t({ sv: "Klassnamn (SV)", en: "Class name (SV)" })}</Label>
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
            <Label htmlFor="rt">{t({ sv: "Rekommendationstext", en: "Recommendation text" })}</Label>
            <Textarea id="rt" rows={2} value={(t({ sv: draft.recommendation_text_sv, en: draft.recommendation_text_en })) ?? ""}
              onChange={(e) => setDraft({ ...draft, [lang === "sv" ? "recommendation_text_sv" : "recommendation_text_en"]: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="rs">{t({ sv: "Motivering", en: "Reasoning" })}</Label>
            <Textarea id="rs" rows={4} value={draft.reasoning_sv ?? ""} onChange={(e) => setDraft({ ...draft, reasoning_sv: e.target.value })} />
          </div>
        </div>
      ) : (
        <>
          <div
            className="relative overflow-hidden rounded-3xl p-7 text-center shadow-card"
            style={{ background: "var(--gradient-pine)" }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, white 35%, transparent) 0%, transparent 60%)",
              }}
              aria-hidden
            />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.3em] text-primary-foreground/70 font-bold">
                {t({ sv: "Klassad ull", en: "Wool class" })}
              </p>
              <div className="text-6xl font-black text-primary-foreground tracking-wider mt-1 leading-none">
                {data.wool_class}
              </div>
              <h2 className="text-base font-semibold text-primary-foreground/95 mt-2">{className}</h2>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-background/15 backdrop-blur text-primary-foreground">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    data.confidence === "high"
                      ? "bg-emerald-300"
                      : data.confidence === "medium"
                      ? "bg-amber-300"
                      : "bg-rose-300"
                  }`}
                />
                <span className="opacity-80">{t("confidence")}:</span>
                <span className="font-semibold">
                  {data.confidence === "high" ? t("high") : data.confidence === "medium" ? t("medium") : t("low")}
                </span>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl p-5 ${recColor}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("recommendation")}</p>
            <p className="text-lg font-bold mt-1">{recText}</p>
          </div>

          {data.wool_class && (
            <TactileSelfCheck
              classificationId={data.id}
              woolClass={data.wool_class}
              onCorrectionSuggested={(suggested) => {
                setDraft({
                  wool_class: suggested,
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
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {data.reasoning_sv && lang === "sv" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => { haptic("select"); setShowReasoning((v) => !v); }}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/50 transition"
                aria-expanded={showReasoning}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Info className="w-4 h-4 text-primary" />
                  {t({ sv: "Varför denna klass?", en: "Why this class?" })}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${showReasoning ? "rotate-180" : ""}`}
                />
              </button>
              {showReasoning && (
                <div className="px-4 pb-4 text-sm text-foreground/85 leading-relaxed border-t border-border pt-3">
                  {data.reasoning_sv}
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    {t({ sv: "Tycker du klassen är fel? Tryck på Redigera ovan för att korrigera.", en: "Think the class is wrong? Tap Edit above to correct it." })}
                  </p>
                </div>
              )}
            </div>
          )}

          {!data.user_confirmed && data.wool_class && (
            <div className="bg-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center gap-3">
              <div className="text-2xl">🎯</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {t({ sv: "Stämmer klassen?", en: "Is this class right?" })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t({ sv: "Bekräfta så lär sig AI:n din gårds ull bättre.", en: "Confirm so the AI learns your farm's wool better." })}
                </p>
              </div>
              <Button size="sm" onClick={confirmClass} className="rounded-xl shrink-0">
                <Check className="w-4 h-4 mr-1" />
                {t({ sv: "Bekräfta", en: "Confirm" })}
              </Button>
            </div>
          )}
          {data.user_confirmed && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              {data.wool_class !== data.original_wool_class
                ? (t({ sv: `Korrigerad från ${data.original_wool_class ?? "?"} → ${data.wool_class} — AI:n lär sig`, en: `Corrected from ${data.original_wool_class ?? "?"} → ${data.wool_class} — AI is learning` }))
                : (t({ sv: "Bekräftad — bidrar till AI-träning", en: "Confirmed — contributing to AI training" }))}
            </div>
          )}

          {data.wool_class && (
            <PaymentBreakdownCard classificationId={data.id} woolClass={data.wool_class} />
          )}

          <div className={data.mode === "sheared" ? "" : "grid grid-cols-2 gap-3"}>
            {data.mode !== "sheared" && (
              <Button asChild size="lg" className="h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => haptic("tap")}>
                <Link to="/app/shearers">
                  <Scissors className="w-5 h-5 mr-1" />
                  {t("bookShearer")}
                </Link>
              </Button>
            )}
            <Button onClick={() => { haptic("success"); saveToFlock(); }} size="lg" variant="outline" className={`h-14 rounded-2xl border-2 ${data.mode === "sheared" ? "w-full" : ""}`}>
              <Sheet className="w-5 h-5 mr-1" />
              {t("saveToFlock")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
