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
      <div className="mt-8 text-center text-sm text-muted-foreground">
        {mode === "signup" ? t("haveAccount") : t("noAccount")}{" "}
        <Link to="/auth" search={{ mode: mode === "signup" ? "signin" : "signup" }} className="text-primary font-semibold underline underline-offset-4">
          {mode === "signup" ? t("signIn") : t("signUp")}
        </Link>
      </div>
    </div>
  );
}
