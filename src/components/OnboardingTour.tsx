import { useEffect, useState } from "react";
import { Camera, Sparkles, Scissors, Sheet, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

const STORAGE_KEY = "ullkollen.onboarded.v1";

type Step = {
  emoji: string;
  Icon: typeof Camera;
  title_sv: string;
  title_en: string;
  body_sv: string;
  body_en: string;
};

const STEPS: Step[] = [
  {
    emoji: "📸",
    Icon: Camera,
    title_sv: "Ta bilder på fåret",
    title_en: "Take photos of the sheep",
    body_sv: "En helkroppsbild och en närbild på ullen räcker. Utomhus i dagsljus ger bäst resultat.",
    body_en: "One full-body shot and one wool close-up is enough. Outdoor daylight works best.",
  },
  {
    emoji: "✨",
    Icon: Sparkles,
    title_sv: "Få en AI-klassning",
    title_en: "Get an AI classification",
    body_sv: "Vår AI bedömer ullklassen och säger om det är dags att klippa — på några sekunder.",
    body_en: "Our AI grades the wool class and tells you if it's time to shear — in seconds.",
  },
  {
    emoji: "🐑",
    Icon: Sheet,
    title_sv: "Bygg upp din flock",
    title_en: "Build up your flock",
    body_sv: "Spara varje klassning till ett får så har du historik per individ.",
    body_en: "Save each classification to a sheep and keep a history per animal.",
  },
  {
    emoji: "✂️",
    Icon: Scissors,
    title_sv: "Hitta en klippare",
    title_en: "Find a shearer",
    body_sv: "Bläddra bland klippare nära dig och skicka en bokningsförfrågan direkt i appen.",
    body_en: "Browse shearers near you and send a booking request straight from the app.",
  },
];

export function OnboardingTour() {
  const { lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-background w-full max-w-md rounded-3xl shadow-card border border-border overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="flex justify-between items-center p-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <button
            onClick={close}
            aria-label={t({ sv: "Stäng", en: "Close" })}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-2 pt-2 text-center">
          <div className="text-7xl mb-4">{s.emoji}</div>
          <h3 className="font-display text-2xl font-bold text-primary">
            {t({ sv: s.title_sv, en: s.title_en })}
          </h3>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            {t({ sv: s.body_sv, en: s.body_en })}
          </p>
        </div>

        <div className="p-5 flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-12 rounded-2xl"
              onClick={() => {
                haptic("select");
                setStep((s) => s - 1);
              }}
            >
              {lang === "sv" ? "Tillbaka" : "Back"}
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 h-12 rounded-2xl"
            style={{ background: "var(--gradient-pine)" }}
            onClick={() => {
              haptic("tap");
              if (isLast) close();
              else setStep((s) => s + 1);
            }}
          >
            {isLast ? (t({ sv: "Sätt igång!", en: "Let's go!" })) : (t({ sv: "Nästa", en: "Next" }))}
            {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>

        {!isLast && (
          <button
            onClick={close}
            className="w-full text-xs text-muted-foreground py-3 hover:text-foreground border-t border-border"
          >
            {t({ sv: "Hoppa över rundturen", en: "Skip the tour" })}
          </button>
        )}
      </div>
    </div>
  );
}
