import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Camera, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { classifyWool } from "@/lib/wool-ai.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/classify")({
  component: Classify,
});

const BREEDS = ["Gotlandsfår", "Finull", "Leicester", "Texel", "Suffolk", "Roslagsfår", "Ryafår", "Värmlandsfår", "Annan"];

function Classify() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [meta, setMeta] = useState({
    sheepName: "",
    breed: "Gotlandsfår",
    age_category: "Tacka" as "Lamm" | "Tacka" | "Bagge",
    months_since_last_shear: 6,
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPhotos((p) => [...p, ...files].slice(0, 3));
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))].slice(0, 3));
    e.target.value = "";
  };

  const remove = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!user) return;
    if (photos.length < 2) {
      toast.error(t("needAtLeast2Photos"));
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      // 1. Insert classification row to get an id
      const { data: row, error } = await supabase
        .from("classifications")
        .insert({
          user_id: user.id,
          status: "processing",
          breed: meta.breed,
          age_category: meta.age_category,
          months_since_last_shear: meta.months_since_last_shear,
          photo_urls: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      const classId = row.id as string;

      // 2. Upload photos to sheep-photos/{user_id}/{classification_id}/
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i];
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${user.id}/${classId}/photo_${i + 1}.${ext}`;
        const { error: upErr } = await supabase.storage.from("sheep-photos").upload(path, f, {
          contentType: f.type || "image/jpeg",
          upsert: true,
        });
        if (upErr) throw upErr;
        paths.push(path);
        setProgress(Math.round(((i + 1) / photos.length) * 50));
      }

      // 3. Get signed URLs for the AI to consume
      const signed = await Promise.all(
        paths.map((p) => supabase.storage.from("sheep-photos").createSignedUrl(p, 3600)),
      );
      const image_urls = signed.map((s) => s.data?.signedUrl).filter(Boolean) as string[];

      await supabase.from("classifications").update({ photo_urls: paths }).eq("id", classId);
      setProgress(60);

      // 4. Run the AI analysis through the app server, then store the result
      const analysis = await classifyWool({
        data: {
          image_urls,
          metadata: meta,
        },
      });
      setProgress(100);

      const r = analysis.result;
      const { error: saveErr } = await supabase
        .from("classifications")
        .update({
          status: "completed",
          wool_class: r.wool_class,
          wool_class_name_sv: r.wool_class_name_sv,
          wool_class_name_en: r.wool_class_name_en,
          confidence: r.confidence,
          shear_recommendation: r.shear_recommendation,
          weeks_until_optimal: r.weeks_until_optimal,
          recommendation_text_sv: r.recommendation_text_sv,
          recommendation_text_en: r.recommendation_text_en,
          reasoning_sv: r.reasoning_sv,
          needs_retake: r.needs_retake,
          retake_reason_sv: r.retake_reason_sv,
          raw_ai_response: analysis.raw_ai_response,
          completed_at: new Date().toISOString(),
        })
        .eq("id", classId);
      if (saveErr) throw saveErr;

      navigate({ to: "/app/result/$id", params: { id: classId } });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-6xl animate-pulse">🐑</div>
        <h2 className="text-xl font-bold text-primary text-center">{t("analyzing")}</h2>
        <div className="w-full max-w-xs h-3 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          {progress < 60 ? t("uploading") : lang === "sv" ? "AI analyserar bilderna..." : "AI is analyzing photos..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/app" className="inline-flex items-center gap-2 text-muted-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> {t("back")}
      </Link>

      {step === 1 && (
        <>
          <h2 className="text-xl font-bold text-primary">{t("takePhotos")}</h2>
          <ul className="space-y-2 text-sm text-muted-foreground bg-secondary/60 rounded-2xl p-4">
            <li>📸 1. {t("photo1")}</li>
            <li>📸 2. {t("photo2")}</li>
            <li>📏 3. {t("photo3")}</li>
          </ul>

          <div className="grid grid-cols-3 gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-secondary">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => remove(i)}
                  className="absolute top-1 right-1 w-7 h-7 bg-background/90 rounded-full flex items-center justify-center"
                  aria-label={t("retake")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-border bg-card flex flex-col items-center justify-center gap-1 text-muted-foreground active:scale-95 transition"
              >
                <Camera className="w-8 h-8" />
                <span className="text-xs">{t("addPhoto")}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />

          <Button
            onClick={() => setStep(2)}
            disabled={photos.length < 2}
            size="lg"
            className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90"
          >
            {t("next")}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-xl font-bold text-primary">{t("metadata")}</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-base">{t("sheepName")}</Label>
              <Input value={meta.sheepName} onChange={(e) => setMeta({ ...meta, sheepName: e.target.value })} className="h-14 text-base mt-2 rounded-xl" />
            </div>
            <div>
              <Label className="text-base">{t("breed")}</Label>
              <Select value={meta.breed} onValueChange={(v) => setMeta({ ...meta, breed: v })}>
                <SelectTrigger className="h-14 mt-2 rounded-xl text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BREEDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base">{t("ageCategory")}</Label>
              <Select value={meta.age_category} onValueChange={(v) => setMeta({ ...meta, age_category: v as typeof meta.age_category })}>
                <SelectTrigger className="h-14 mt-2 rounded-xl text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lamm">Lamm</SelectItem>
                  <SelectItem value="Tacka">Tacka</SelectItem>
                  <SelectItem value="Bagge">Bagge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base">{t("monthsSinceLastShear")}</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={meta.months_since_last_shear}
                onChange={(e) => setMeta({ ...meta, months_since_last_shear: parseInt(e.target.value) || 0 })}
                className="h-14 text-base mt-2 rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} size="lg" className="flex-1 h-14 rounded-2xl border-2">{t("back")}</Button>
            <Button onClick={submit} size="lg" className="flex-1 h-14 rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90">
              {t("classify")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
