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
    <div className="min-h-screen flex flex-col items-center justify-between px-6 py-10 bg-background">
      <div className="self-end">
        <button
          onClick={() => setLang(lang === "sv" ? "en" : "sv")}
          className="text-sm text-muted-foreground px-3 py-2 rounded-full bg-secondary"
        >
          {lang === "sv" ? "EN" : "SV"}
        </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <SheepLogo className="w-32 h-32 text-primary mb-6" />
        <h1 className="text-5xl font-black text-primary tracking-tight">{t("appName")}</h1>
        <p className="text-lg text-muted-foreground mt-3 max-w-xs">{t("tagline")}</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button asChild size="lg" className="w-full h-14 text-base bg-primary hover:bg-primary/90 rounded-2xl">
          <Link to="/auth" search={{ mode: "signup" }}>{t("signUp")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full h-14 text-base border-2 rounded-2xl">
          <Link to="/auth" search={{ mode: "signin" }}>{t("signIn")}</Link>
        </Button>
      </div>
    </div>
  );
}
