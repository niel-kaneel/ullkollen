import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { SheepLogo } from "@/components/SheepLogo";
import { toast } from "sonner";

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-10 bg-background">
      <Link to="/" className="text-muted-foreground text-sm mb-8">← {t("back")}</Link>
      <div className="flex flex-col items-center mb-8">
        <SheepLogo className="w-16 h-16 text-primary mb-3" />
        <h1 className="text-2xl font-bold text-primary">{mode === "signup" ? t("signUp") : t("signIn")}</h1>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="email" className="text-base">{t("email")}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 text-base mt-2 rounded-xl" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password" className="text-base">{t("password")}</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 text-base mt-2 rounded-xl" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>
        <Button type="submit" disabled={busy} size="lg" className="w-full h-14 text-base rounded-2xl bg-primary hover:bg-primary/90">
          {busy ? "..." : mode === "signup" ? t("signUp") : t("signIn")}
        </Button>
      </form>
      <div className="mt-8 text-center text-sm text-muted-foreground">
        {mode === "signup" ? t("haveAccount") : t("noAccount")}{" "}
        <Link to="/auth" search={{ mode: mode === "signup" ? "signin" : "signup" }} className="text-primary font-semibold underline">
          {mode === "signup" ? t("signIn") : t("signUp")}
        </Link>
      </div>
    </div>
  );
}
