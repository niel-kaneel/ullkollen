import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Camera, X, ImagePlus, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { classifyWool } from "@/lib/wool-ai.functions";
import { PageHeader } from "@/components/PageHeader";
import { StepIndicator } from "@/components/StepIndicator";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { haptic } from "@/lib/haptics";
import { BREEDS, BREED_BY_CODE } from "@/lib/breeds";

export const Route = createFileRoute("/app/classify")({
  component: Classify,
});

// ── Scanning mode ────────────────────────────────────────────────────────────
export type ScanMode = "on_sheep" | "sheared";
const LAST_MODE_KEY = "ullkollen.lastScanMode";

type ShotKey = string;

type ShotDef = {
  key: ShotKey;
  required: boolean;
  emoji: string;
  title_sv: string;
  title_en: string;
  desc_sv: string;
  desc_en: string;
};

const SHOTS_ON_SHEEP: ShotDef[] = [
  {
    key: "full_body",
    required: true,
    emoji: "🐑",
    title_sv: "Helbild på fåret",
    title_en: "Whole sheep",
    desc_sv: "Stå 2–3 meter bort, helkroppsbild.",
    desc_en: "Stand 2–3 metres away, full-body shot.",
  },
  {
    key: "fleece_closeup",
    required: true,
    emoji: "🔍",
    title_sv: "Närbild på ullen (sida/rygg/bog)",
    title_en: "Wool close-up (flank/back/shoulder)",
    desc_sv: "15–20 cm från ullen. Välj kroppsdel nedan.",
    desc_en: "15–20 cm from the wool. Pick body area below.",
  },
  {
    key: "length_reference",
    required: false,
    emoji: "📏",
    title_sv: "Visa fiberlängden (rekommenderas)",
    title_en: "Show the fibre length (recommended)",
    desc_sv: "Sträck en lock mot ditt finger eller en linjal.",
    desc_en: "Stretch a lock against your finger or a ruler.",
  },
];

const SHOTS_SHEARED: ShotDef[] = [
  {
    key: "fleece_flat",
    required: true,
    emoji: "🧶",
    title_sv: "Hela fleecen utlagd platt",
    title_en: "Whole fleece laid flat",
    desc_sv: "Lägg fleecen platt på ett neutralt underlag i jämnt ljus.",
    desc_en: "Lay the fleece flat on a neutral background in even lighting.",
  },
  {
    key: "fleece_closeup",
    required: true,
    emoji: "🔍",
    title_sv: "Närbild på ullstrukturen",
    title_en: "Close-up of the wool structure",
    desc_sv: "15–20 cm från ullen — visa krusighet och glans.",
    desc_en: "15–20 cm from the wool — show crimp and luster.",
  },
  {
    key: "length_reference",
    required: false,
    emoji: "📏",
    title_sv: "Skala (linjal/mynt) — rekommenderas",
    title_en: "Scale reference (ruler/coin) — recommended",
    desc_sv: "Lägg en linjal eller ett mynt bredvid en lock för storlek.",
    desc_en: "Place a ruler or coin next to a lock for scale.",
  },
];

const BODY_AREAS = [
  { value: "flank",    sv: "Sida (flank)",    en: "Flank" },
  { value: "shoulder", sv: "Bog (axel)",      en: "Shoulder" },
  { value: "back",     sv: "Rygg",            en: "Back" },
  { value: "britch",   sv: "Bakdel (britch)", en: "Britch" },
  { value: "neck",     sv: "Hals",            en: "Neck" },
];

type CapturedShot = {
  file: File;
  preview: string;
  quality: PhotoQuality;
};

type PhotoQuality = {
  ok: boolean;
  sharpness: number;
  brightness: number;
  warning_sv: string | null;
  warning_en: string | null;
};

function Classify() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step 0 = mode pick, 1 = photos, 2 = metadata
  const [mode, setMode] = useState<ScanMode | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [shots, setShots] = useState<Partial<Record<ShotKey, CapturedShot>>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sheepList, setSheepList] = useState<{ id: string; name: string | null; ear_tag_id: string | null }[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const targetShot = useRef<ShotKey | null>(null);

  const [meta, setMeta] = useState({
    sheepName: "",
    sheep_id: "",
    body_area: "flank",
    breed_codes: [] as string[],
    age_category: "Tacka" as "Lamm" | "Tacka" | "Bagge",
    months_since_last_shear: 6,
    fleece_id: "",
    shearing_date: "",
  });

  const toggleBreed = (code: string) => {
    setMeta((m) => {
      const has = m.breed_codes.includes(code);
      let next = has ? m.breed_codes.filter((c) => c !== code) : [...m.breed_codes, code];
      if (next.length === 0) next = [code]; // always keep at least one
      return { ...m, breed_codes: next };
    });
  };

  // Pre-select last used mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem(LAST_MODE_KEY) as ScanMode | null;
    if (last === "on_sheep" || last === "sheared") {
      setMode(last);
      setStep(1);
    }
  }, []);

  // Load farmer's sheep for the on-sheep selector
  useEffect(() => {
    if (!user) return;
    supabase
      .from("sheep")
      .select("id, name, ear_tag_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSheepList((data as any) ?? []));
  }, [user?.id]);

  useUnsavedChangesGuard(Object.keys(shots).length > 0 && !busy);

  const SHOTS = mode === "sheared" ? SHOTS_SHEARED : SHOTS_ON_SHEEP;

  const pickMode = (m: ScanMode) => {
    haptic("tap");
    setMode(m);
    setShots({});
    if (typeof window !== "undefined") window.localStorage.setItem(LAST_MODE_KEY, m);
    setStep(1);
  };

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

  const openCapture = (key: ShotKey, m: "camera" | "gallery") => {
    targetShot.current = key;
    if (m === "camera") cameraRef.current?.click();
    else galleryRef.current?.click();
  };

  const requiredShotKeys = SHOTS.filter((s) => s.required).map((s) => s.key);
  const hasRequired = requiredShotKeys.every((k) => shots[k]);
  const totalShots = Object.values(shots).filter(Boolean).length;

  const submit = async () => {
    if (!user || !mode) return;
    if (!hasRequired) {
      toast.error(lang === "sv" ? "Lägg till båda obligatoriska bilderna." : "Add both required photos.");
      return;
    }
    setBusy(true);
    setProgress(0);
    let createdClassId: string | null = null;
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
          mode,
          body_area: mode === "on_sheep" ? meta.body_area : null,
          fleece_id: mode === "sheared" ? meta.fleece_id || null : null,
          shearing_date: mode === "sheared" ? meta.shearing_date || null : null,
          sheep_id: mode === "on_sheep" && meta.sheep_id ? meta.sheep_id : null,
          breed: meta.breed_codes.map((c) => BREED_BY_CODE[c]?.name_sv ?? c).join(" + ") || null,
          breed_code: meta.breed_codes.join(","),
          age_category: meta.age_category,
          months_since_last_shear: meta.months_since_last_shear,
          photo_urls: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      const classId = row.id as string;
      createdClassId = classId;

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
          metadata: {
            ...meta,
            mode,
          },
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
      // Don't strand the row in "processing" — mark it failed so the user
      // sees a proper error state and can retry.
      if (createdClassId) {
        await supabase
          .from("classifications")
          .update({ status: "failed", retake_reason_sv: err instanceof Error ? err.message : null })
          .eq("id", createdClassId);
      }
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

  // ── Step 0: Mode picker ───────────────────────────────────────────────────
  if (step === 0 || !mode) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={lang === "sv" ? "Vad ska du skanna?" : "What are you scanning?"}
          subtitle={
            lang === "sv"
              ? "Välj sammanhang så anpassar vi vägledningen i kameran."
              : "Pick the context — we'll tailor the camera guidance."
          }
        />
        <StepIndicator
          current={1}
          total={3}
          labels={lang === "sv" ? ["Läge", "Bilder", "Detaljer"] : ["Mode", "Photos", "Details"]}
        />

        <div className="grid gap-3">
          <ModeCard
            emoji="🐑"
            title={lang === "sv" ? "Skanna på fåret" : "Scan on sheep"}
            desc={
              lang === "sv"
                ? "Levande får med ullen kvar. Bra inför beslut om klippning."
                : "Live sheep with wool still attached. Useful before deciding to shear."
            }
            onClick={() => pickMode("on_sheep")}
          />
          <ModeCard
            emoji="🧶"
            title={lang === "sv" ? "Skanna klippt ull" : "Scan sheared wool"}
            desc={
              lang === "sv"
                ? "Lös fleece efter klippning. För kvalitetskontroll och sortering."
                : "Loose fleece after shearing. For quality grading and sorting."
            }
            onClick={() => pickMode("sheared")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={step === 2 ? t("metadata") : t("takePhotos")}
        action={
          <button
            onClick={() => setStep(0)}
            className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition"
          >
            <ArrowLeft className="w-3 h-3" />
            {mode === "on_sheep"
              ? (lang === "sv" ? "Läge: På fåret" : "Mode: On sheep")
              : (lang === "sv" ? "Läge: Klippt ull" : "Mode: Sheared")}
          </button>
        }
      />

      <StepIndicator
        current={step === 1 ? 2 : step === 2 ? 3 : 1}
        total={3}
        labels={
          lang === "sv"
            ? ["Läge", "Bilder", "Detaljer"]
            : ["Mode", "Photos", "Details"]
        }
      />

      {step === 1 && (
        <>
          <p className="text-sm text-muted-foreground">
            {lang === "sv"
              ? "Ta varje bild i sin egen ruta. Fler bilder = säkrare AI-bedömning."
              : "Capture each shot in its own slot. More shots = more confident AI grading."}
          </p>

          <div className="bg-card border border-border rounded-3xl p-4 shadow-soft">
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-1">
              {lang === "sv" ? "Bästa bilder" : "Best photos"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              💡 {mode === "on_sheep"
                ? lang === "sv"
                  ? "Utomhus i jämnt dagsljus, undvik direkt motljus. Fota från sida, rygg eller bog."
                  : "Outdoors in even daylight, avoid backlight. Shoot the flank, back or shoulder."
                : lang === "sv"
                  ? "Lägg fleecen platt på ett neutralt underlag. Använd gärna en linjal eller ett mynt som skala."
                  : "Lay the fleece flat on a neutral background. A ruler or coin gives helpful scale."}
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
              ? `${totalShots}/${SHOTS.length} bilder · ${hasRequired ? "redo" : "lägg till de två obligatoriska"}`
              : `${totalShots}/${SHOTS.length} photos · ${hasRequired ? "ready" : "add the two required shots"}`}
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
          <div className="rounded-2xl border-2 border-border bg-card p-4 flex items-start gap-3 shadow-soft">
            <div className="text-2xl leading-none mt-0.5">{mode === "sheared" ? "🧶" : "🐑"}</div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="sheared-toggle" className="text-base font-semibold cursor-pointer">
                {lang === "sv" ? "Ullen är redan klippt" : "Wool is already shorn"}
              </Label>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {mode === "sheared"
                  ? lang === "sv"
                    ? "Rekommendationen handlar om sortering och leverans — inte om när du ska klippa."
                    : "Recommendation will cover sorting and delivery — not when to shear."
                  : lang === "sv"
                    ? "Rekommendationen handlar om när det är bäst att klippa fåret."
                    : "Recommendation will advise when to shear the sheep."}
              </p>
            </div>
            <Switch
              id="sheared-toggle"
              checked={mode === "sheared"}
              onCheckedChange={(checked) => {
                haptic("select");
                setMode(checked ? "sheared" : "on_sheep");
              }}
            />
          </div>

          <div className="space-y-4">
            {mode === "on_sheep" && (
              <>
                <div>
                  <Label className="text-base">{t("sheepName")}</Label>
                  <Input value={meta.sheepName} onChange={(e) => setMeta({ ...meta, sheepName: e.target.value })} className="h-14 text-base mt-2 rounded-xl" />
                </div>
                {sheepList.length > 0 && (
                  <div>
                    <Label className="text-base">
                      {lang === "sv" ? "Koppla till får (valfritt)" : "Link to sheep (optional)"}
                    </Label>
                    <Select value={meta.sheep_id} onValueChange={(v) => setMeta({ ...meta, sheep_id: v })}>
                      <SelectTrigger className="h-14 mt-2 rounded-xl text-base"><SelectValue placeholder={lang === "sv" ? "— Inget specifikt får —" : "— No specific sheep —"} /></SelectTrigger>
                      <SelectContent>
                        {sheepList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name || s.ear_tag_id || s.id.slice(0, 6)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-base">{lang === "sv" ? "Kroppsdel på bilden" : "Body area shown"}</Label>
                  <Select value={meta.body_area} onValueChange={(v) => setMeta({ ...meta, body_area: v })}>
                    <SelectTrigger className="h-14 mt-2 rounded-xl text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BODY_AREAS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>{lang === "sv" ? a.sv : a.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {mode === "sheared" && (
              <>
                <div>
                  <Label className="text-base">{lang === "sv" ? "Fleece-ID (valfritt)" : "Fleece ID (optional)"}</Label>
                  <Input
                    value={meta.fleece_id}
                    onChange={(e) => setMeta({ ...meta, fleece_id: e.target.value })}
                    placeholder={lang === "sv" ? "t.ex. F-2026-014" : "e.g. F-2026-014"}
                    className="h-14 text-base mt-2 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-base">{lang === "sv" ? "Klippdatum" : "Shearing date"}</Label>
                  <Input
                    type="date"
                    value={meta.shearing_date}
                    onChange={(e) => setMeta({ ...meta, shearing_date: e.target.value })}
                    className="h-14 text-base mt-2 rounded-xl"
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-base">{t("breed")}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "sv"
                  ? "Välj en eller flera raser (t.ex. korsning eller blandfäll)."
                  : "Pick one or more breeds (e.g. crossbreed or mixed fleece)."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {BREEDS.map((b) => {
                  const selected = meta.breed_codes.includes(b.code);
                  return (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => toggleBreed(b.code)}
                      className={
                        "px-3 py-2 rounded-full text-sm font-semibold border-2 transition active:scale-95 " +
                        (selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/60")
                      }
                    >
                      {b.name_sv}
                    </button>
                  );
                })}
              </div>
            </div>
            {mode === "on_sheep" && (
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
            )}
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

function ModeCard({ emoji, title, desc, onClick }: { emoji: string; title: string; desc: string; onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer active:scale-[0.99] transition border-2 border-border hover:border-primary/60 rounded-3xl shadow-soft"
    >
      <CardContent className="p-5 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-3xl flex-shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold text-primary">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
        </div>
      </CardContent>
    </Card>
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
