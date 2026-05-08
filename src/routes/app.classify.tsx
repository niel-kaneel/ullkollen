import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Camera, X, ImagePlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { classifyWool } from "@/lib/wool-ai.functions";
import { BackButton } from "@/components/BackButton";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { haptic } from "@/lib/haptics";

export const Route = createFileRoute("/app/classify")({
  component: Classify,
});

import { BREEDS, BREED_BY_CODE } from "@/lib/breeds";

// Structured shot slots — each tells the AI exactly what it's looking at,
// which dramatically improves classification quality.
type ShotKey = "full_body" | "fleece_closeup" | "length_reference";

type ShotDef = {
  key: ShotKey;
  required: boolean;
  emoji: string;
  title_sv: string;
  title_en: string;
  desc_sv: string;
  desc_en: string;
};

const SHOTS: ShotDef[] = [
  {
    key: "full_body",
    required: true,
    emoji: "🐑",
    title_sv: "Ta en bild på hela fåret",
    title_en: "Take a photo of the whole sheep",
    desc_sv: "Stå 2–3 meter bort, helkroppsbild.",
    desc_en: "Stand 2–3 metres away, full-body shot.",
  },
  {
    key: "fleece_closeup",
    required: true,
    emoji: "🔍",
    title_sv: "Närbild på ullen",
    title_en: "Close-up of the wool",
    desc_sv: "15–20 cm från ullen, sida eller rygg.",
    desc_en: "15–20 cm from the wool, side or back.",
  },
  {
    key: "length_reference",
    required: false,
    emoji: "📏",
    title_sv: "Visa fiberlängden (rekommenderas)",
    title_en: "Show the fibre length (recommended)",
    desc_sv: "Sträck en lock mot ditt finger eller en linjal. Hoppa över om du inte kan.",
    desc_en: "Stretch a lock against your finger or a ruler. Skip if you can't.",
  },
];

type CapturedShot = {
  file: File;
  preview: string;
  quality: PhotoQuality;
};

type PhotoQuality = {
  ok: boolean;
  sharpness: number; // Laplacian-like variance, 0-1+
  brightness: number; // 0-255
  warning_sv: string | null;
  warning_en: string | null;
};

function Classify() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [shots, setShots] = useState<Partial<Record<ShotKey, CapturedShot>>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const targetShot = useRef<ShotKey | null>(null);

  const [meta, setMeta] = useState({
    sheepName: "",
    breed_code: "gotland",
    age_category: "Tacka" as "Lamm" | "Tacka" | "Bagge",
    months_since_last_shear: 6,
  });

  // Skydda mot oavsiktligt stäng-fönster om foton är tagna men inte skickade in
  useUnsavedChangesGuard(Object.keys(shots).length > 0 && !busy);


  // Downscale + compress; bumped to 1600px so fleece detail survives for the AI.
  const downscaleImage = async (file: File, maxDim = 1600, quality = 0.86): Promise<File> => {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      return file;
    }
  };

  // On-device quality check: estimates sharpness via mean abs Laplacian on a
  // downscaled greyscale, plus average brightness. Cheap, runs in <50ms.
  const analyzeQuality = async (file: File): Promise<PhotoQuality> => {
    try {
      const bitmap = await createImageBitmap(file);
      const w = 256;
      const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * 256));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return { ok: true, sharpness: 1, brightness: 128, warning_sv: null, warning_en: null };
      ctx.drawImage(bitmap, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const grey = new Float32Array(w * h);
      let bSum = 0;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grey[p] = v;
        bSum += v;
      }
      const brightness = bSum / (w * h);
      // 4-neighbour Laplacian variance proxy
      let sum = 0;
      let sum2 = 0;
      let n = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const lap = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
          sum += lap;
          sum2 += lap * lap;
          n++;
        }
      }
      const mean = sum / n;
      const variance = sum2 / n - mean * mean;
      // Normalise: typical sharp photo ~600-2000, blurry <150
      const sharpness = Math.min(2, variance / 400);

      let warning_sv: string | null = null;
      let warning_en: string | null = null;
      if (sharpness < 0.18) {
        warning_sv = "Bilden ser väldigt oskarp ut – ta gärna om.";
        warning_en = "Image looks very blurry – consider retaking.";
      } else if (brightness < 35) {
        warning_sv = "Bilden är väldigt mörk – mer ljus hjälper.";
        warning_en = "Image is very dark – more light helps.";
      } else if (brightness > 245) {
        warning_sv = "Bilden är överexponerad – undvik direkt motljus.";
        warning_en = "Image is overexposed – avoid direct backlight.";
      }
      return { ok: !warning_sv, sharpness, brightness, warning_sv, warning_en };
    } catch {
      return { ok: true, sharpness: 1, brightness: 128, warning_sv: null, warning_en: null };
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e.target.files ?? [])[0];
    e.target.value = "";
    if (!file || !targetShot.current) return;
    const slot = targetShot.current;
    targetShot.current = null;

    const processed = await downscaleImage(file);
    const quality = await analyzeQuality(processed);
    const preview = URL.createObjectURL(processed);
    setShots((s) => ({ ...s, [slot]: { file: processed, preview, quality } }));
    if (quality.warning_sv) {
      toast.warning(lang === "sv" ? quality.warning_sv : quality.warning_en ?? "");
    }
  };

  const removeShot = (key: ShotKey) => {
    setShots((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
  };

  const openCapture = (key: ShotKey, mode: "camera" | "gallery") => {
    targetShot.current = key;
    if (mode === "camera") cameraRef.current?.click();
    else galleryRef.current?.click();
  };

  const requiredShotKeys = SHOTS.filter((s) => s.required).map((s) => s.key);
  const hasRequired = requiredShotKeys.every((k) => shots[k]);
  const totalShots = Object.values(shots).filter(Boolean).length;

  const submit = async () => {
    if (!user) return;
    if (!hasRequired) {
      toast.error(lang === "sv" ? "Lägg till båda obligatoriska bilderna." : "Add both required photos.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const ordered = SHOTS.filter((s) => shots[s.key]).map((s) => ({
        key: s.key,
        file: shots[s.key]!.file,
      }));

      const { data: row, error } = await supabase
        .from("classifications")
        .insert({
          user_id: user.id,
          status: "processing",
          breed: BREED_BY_CODE[meta.breed_code]?.name_sv ?? null,
          breed_code: meta.breed_code,
          age_category: meta.age_category,
          months_since_last_shear: meta.months_since_last_shear,
          photo_urls: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      const classId = row.id as string;

      let uploaded = 0;
      const uploads = await Promise.all(
        ordered.map(async (shot, i) => {
          const path = `${user.id}/${classId}/${i + 1}_${shot.key}.jpg`;
          const { error: upErr } = await supabase.storage.from("sheep-photos").upload(path, shot.file, {
            contentType: "image/jpeg",
            upsert: true,
          });
          if (upErr) throw upErr;
          uploaded++;
          setProgress(Math.round((uploaded / ordered.length) * 50));
          return { path, key: shot.key };
        }),
      );

      const signed = await Promise.all(
        uploads.map((u) => supabase.storage.from("sheep-photos").createSignedUrl(u.path, 3600)),
      );
      const labeled_images = uploads
        .map((u, i) => ({ label: u.key, url: signed[i].data?.signedUrl ?? "" }))
        .filter((x) => x.url);

      await supabase.from("classifications").update({ photo_urls: uploads.map((u) => u.path) }).eq("id", classId);
      setProgress(60);

      const analysis = await classifyWool({
        data: {
          image_urls: labeled_images.map((l) => l.url),
          image_labels: labeled_images.map((l) => l.label),
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
      <BackButton />

      {step === 1 && (
        <>
          <div>
            <h2 className="font-display text-2xl font-bold text-primary">{t("takePhotos")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "sv"
                ? "Ta varje bild i sin egen ruta. Fler bilder = säkrare AI-bedömning."
                : "Capture each shot in its own slot. More shots = more confident AI grading."}
            </p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-4 shadow-soft">
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-1">
              {lang === "sv" ? "Bästa bilder" : "Best photos"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              💡 {lang === "sv"
                ? "Utomhus i jämnt dagsljus, undvik direkt motljus, håll mobilen stadigt och kom nära fleecen för närbilden."
                : "Outdoors in even daylight, avoid backlight, hold the phone steady, and get close to the fleece on the close-up."}
            </p>
          </div>

          <div className="space-y-3">
            {SHOTS.map((s, i) => {
              const captured = shots[s.key];
              return (
                <ShotSlot
                  key={s.key}
                  num={i + 1}
                  shot={s}
                  captured={captured}
                  lang={lang}
                  onCamera={() => openCapture(s.key, "camera")}
                  onGallery={() => openCapture(s.key, "gallery")}
                  onRemove={() => removeShot(s.key)}
                />
              );
            })}
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
          />

          <div className="text-xs text-muted-foreground text-center">
            {lang === "sv"
      ? `${totalShots}/3 bilder · ${hasRequired ? "redo" : "lägg till de två obligatoriska"}`
              : `${totalShots}/3 photos · ${hasRequired ? "ready" : "add the two required shots"}`}
          </div>

          <Button
            onClick={() => setStep(2)}
            disabled={!hasRequired}
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
              <Select value={meta.breed_code} onValueChange={(v) => setMeta({ ...meta, breed_code: v })}>
                <SelectTrigger className="h-14 mt-2 rounded-xl text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BREEDS.map((b) => <SelectItem key={b.code} value={b.code}>{b.name_sv}</SelectItem>)}
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

function ShotSlot({
  num,
  shot,
  captured,
  lang,
  onCamera,
  onGallery,
  onRemove,
}: {
  num: number;
  shot: ShotDef;
  captured?: CapturedShot;
  lang: "sv" | "en";
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
}) {
  const title = lang === "sv" ? shot.title_sv : shot.title_en;
  const desc = lang === "sv" ? shot.desc_sv : shot.desc_en;
  const warn = captured?.quality.warning_sv
    ? lang === "sv"
      ? captured.quality.warning_sv
      : captured.quality.warning_en
    : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-3 shadow-soft">
      <div className="flex gap-3 items-start">
        <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-2xl">
          {shot.emoji}
          <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
            {num}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {shot.required ? (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                {lang === "sv" ? "Krävs" : "Required"}
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-bold">
                {lang === "sv" ? "Valfri" : "Optional"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
        </div>
      </div>

      {captured ? (
        <div className="mt-3 flex gap-3">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
            <img src={captured.preview} alt="" className="w-full h-full object-cover" />
            <button
              onClick={onRemove}
              className="absolute top-1 right-1 w-6 h-6 bg-background/90 rounded-full flex items-center justify-center"
              aria-label="remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 min-w-0 text-xs">
            {warn ? (
              <div className="flex gap-1.5 items-start text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{warn}</p>
                  <button onClick={onCamera} className="underline mt-1">
                    {lang === "sv" ? "Ta om" : "Retake"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1.5 items-start text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="font-semibold">{lang === "sv" ? "Bra bild" : "Good photo"}</p>
              </div>
            )}
            <button
              onClick={onCamera}
              className="block mt-2 text-muted-foreground underline"
            >
              {lang === "sv" ? "Byt bild" : "Replace"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onCamera}
            className="h-11 rounded-xl border-2 border-dashed border-border bg-background flex items-center justify-center gap-2 text-foreground font-semibold active:scale-95 transition"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs">{lang === "sv" ? "Ta bild" : "Take"}</span>
          </button>
          <button
            onClick={onGallery}
            className="h-11 rounded-xl border-2 border-dashed border-border bg-background flex items-center justify-center gap-2 text-foreground font-semibold active:scale-95 transition"
          >
            <ImagePlus className="w-4 h-4" />
            <span className="text-xs">{lang === "sv" ? "Galleri" : "Gallery"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
