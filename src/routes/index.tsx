import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SheepLogo } from "@/components/SheepLogo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Landing,
});

function Landing() {
  const { t, lang, setLang } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col px-6 py-8 relative overflow-hidden">
      {/* Decorative barn-red horizon */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-72 h-72 rounded-full opacity-20"
        style={{ background: "var(--gradient-barn)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-24 w-80 h-80 rounded-full opacity-25"
        style={{ background: "var(--gradient-pine)" }}
      />

      <div className="self-end relative z-10">
        <button
          onClick={() => setLang(lang === "sv" ? "en" : "sv")}
          className="text-xs font-semibold tracking-widest text-primary px-4 py-2 rounded-full bg-card border border-border shadow-soft"
        >
          {t({ sv: "EN", en: "SV" })}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
        <div className="mb-8 p-6 rounded-full bg-card shadow-card border border-border">
          <SheepLogo className="w-24 h-24 text-primary" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.3em] text-accent-foreground/70 font-semibold mb-3">
          {t({ sv: "Från gård till garn", en: "From farm to yarn" })}
        </span>
        <h1 className="font-display text-6xl font-bold text-primary tracking-tight leading-none">
          {t("appName")}
        </h1>
        <div className="dashed-divider w-24 my-5" />
        <p className="text-base text-muted-foreground max-w-xs leading-relaxed">{t("tagline")}</p>
      </div>

      <div className="w-full max-w-sm mx-auto space-y-3 relative z-10">
        <Button
          asChild
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-2xl shadow-card"
          style={{ background: "var(--gradient-pine)" }}
        >
          <Link to="/auth" search={{ mode: "signup" }}>{t("signUp")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full h-14 text-base rounded-2xl bg-card/70 backdrop-blur border-2">
          <Link to="/auth" search={{ mode: "signin" }}>{t("signIn")}</Link>
        </Button>
      </div>
    </div>
  );
}
