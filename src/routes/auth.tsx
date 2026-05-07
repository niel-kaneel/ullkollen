import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { SheepLogo } from "@/components/SheepLogo";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: (s.mode as string) === "signup" ? "signup" : "signin" }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation required
          toast.success(
            "Konto skapat! Kolla din e-post för att bekräfta din adress, logga sedan in.",
            { duration: 8000 },
          );
          navigate({ to: "/auth", search: { mode: "signin" } });
        } else {
          navigate({ to: "/onboarding" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("not confirmed")) {
            toast.error("Bekräfta din e-post först — kolla din inkorg.", { duration: 6000 });
            return;
          }
          throw error;
        }
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <Link to="/" className="text-muted-foreground text-sm mb-6 hover:text-primary transition">← {t("back")}</Link>
      <div className="flex flex-col items-center mb-10">
        <div className="p-4 rounded-full bg-card border border-border shadow-soft mb-4">
          <SheepLogo className="w-12 h-12 text-primary" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold mb-2">
          {t("appName")}
        </span>
        <h1 className="font-display text-3xl font-bold text-primary">
          {mode === "signup" ? t("signUp") : t("signIn")}
        </h1>
        <div className="dashed-divider w-16 mt-4" />
      </div>
      <form onSubmit={onSubmit} className="space-y-5 bg-card border border-border rounded-3xl p-6 shadow-card">
        <div>
          <Label htmlFor="email" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("email")}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 text-base mt-2 rounded-xl bg-background" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("password")}</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 text-base mt-2 rounded-xl bg-background" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>
        <Button
          type="submit"
          disabled={busy}
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-2xl shadow-card"
          style={{ background: "var(--gradient-pine)" }}
        >
          {busy ? "..." : mode === "signup" ? t("signUp") : t("signIn")}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">eller</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
            if (r.error) { toast.error(r.error.message); setBusy(false); }
          }}
          className="w-full h-14 text-base rounded-2xl bg-card text-foreground border-2 border-border gap-3 transition-all hover:bg-card hover:text-foreground hover:border-foreground/40 hover:shadow-md"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.7 2.5 2.4 6.8 2.4 12.1S6.7 21.7 12 21.7c6.9 0 9.5-4.8 9.5-7.3 0-.5-.05-.9-.13-1.3H12z"/>
          </svg>
          {mode === "signup" ? "Fortsätt med Google" : "Logga in med Google"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin + "/app" });
            if (r.error) { toast.error(r.error.message); setBusy(false); }
          }}
          className="w-full h-14 text-base rounded-2xl bg-foreground text-background border-2 border-foreground gap-3 hover:bg-foreground/90"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.8.9-3.6.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 3 2.4 1.2-.05 1.7-.8 3.1-.8s1.9.8 3.1.7c1.3-.02 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.03-.01-2.5-1-2.6-3.9zM14 5.4c.6-.8 1.1-1.9.9-3-1 .04-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.3-.6 2.9-1.4z"/>
          </svg>
          {mode === "signup" ? "Fortsätt med Apple" : "Logga in med Apple"}
        </Button>
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        {mode === "signup" ? t("haveAccount") : t("noAccount")}{" "}
        <Link to="/auth" search={{ mode: mode === "signup" ? "signin" : "signup" }} className="text-primary font-semibold underline underline-offset-4">
          {mode === "signup" ? t("signIn") : t("signUp")}
        </Link>
      </div>
    </div>
  );
}
