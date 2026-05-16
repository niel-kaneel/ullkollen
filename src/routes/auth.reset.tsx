import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { SheepLogo } from "@/components/SheepLogo";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/auth/reset")({
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // När användaren klickar i återställningsmejlet skapar Supabase
    // automatiskt en session via URL-parametrarna.
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("passwordsDoNotMatch"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("passwordUpdated"), { duration: 6000 });
      await supabase.auth.signOut();
      navigate({ to: "/auth", search: { mode: "signin" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <Link to="/auth" search={{ mode: "signin" }} className="text-muted-foreground text-sm mb-6 hover:text-primary transition">
        ← {t("backToSignIn")}
      </Link>

      <div className="flex flex-col items-center mb-10">
        <div className="p-4 rounded-full bg-card border border-border shadow-soft mb-4">
          <SheepLogo className="w-12 h-12 text-primary" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold mb-2">
          Ullkollen
        </span>
        <h1 className="font-display text-3xl font-bold text-primary">{t("newPassword")}</h1>
        <div className="dashed-divider w-16 mt-4" />
      </div>

      {hasSession === false ? (
        <div className="bg-card border border-border rounded-3xl p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            {t("resetLinkInvalid")}
          </p>
          <Button asChild className="mt-4 w-full h-12 rounded-2xl">
            <Link to="/auth" search={{ mode: "signin" }}>{t("backToSignIn")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 bg-card border border-border rounded-3xl p-6 shadow-card">
          <div>
            <Label htmlFor="password" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("newPassword")}
            </Label>
            <div className="relative mt-2">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 text-base rounded-xl bg-background pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition rounded-md"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("confirmPassword")}
            </Label>
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-14 text-base mt-2 rounded-xl bg-background"
              autoComplete="new-password"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || hasSession === null}
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl shadow-card"
            style={{ background: "var(--gradient-pine)" }}
          >
            {busy ? "..." : t("saveNewPassword")}
          </Button>
        </form>
      )}
    </div>
  );
}
