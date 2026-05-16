import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SheepLogo } from "@/components/SheepLogo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

type Search = {
  token_hash?: string;
  type?: string;
  next?: string;
  error?: string;
  error_description?: string;
};

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token_hash: typeof s.token_hash === "string" ? s.token_hash : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
    error_description: typeof s.error_description === "string" ? s.error_description : undefined,
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState(t("confirmingEmail"));

  useEffect(() => {
    (async () => {
      // Surface query-string errors from Supabase
      if (search.error) {
        setStatus("error");
        setMessage(search.error_description || search.error);
        return;
      }

      // Newer Supabase flow: token_hash + type in query string
      if (search.token_hash && search.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: search.token_hash,
          type: search.type as "signup" | "email" | "recovery" | "invite" | "email_change",
        });
        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
        setStatus("success");
        toast.success("E-post bekräftad!");
        setTimeout(() => navigate({ to: search.next || "/onboarding" }), 800);
        return;
      }

      // Legacy flow: tokens in URL hash (#access_token=...&refresh_token=...)
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const hashError = params.get("error_description");
        if (hashError) {
          setStatus("error");
          setMessage(hashError);
          return;
        }
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            setStatus("error");
            setMessage(error.message);
            return;
          }
          setStatus("success");
          toast.success("E-post bekräftad!");
          setTimeout(() => navigate({ to: search.next || "/onboarding" }), 800);
          return;
        }
      }

      setStatus("error");
      setMessage(t("confirmLinkInvalid"));
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="p-4 rounded-full bg-card border border-border shadow-soft mb-6">
        <SheepLogo className="w-12 h-12 text-primary" />
      </div>
      <h1 className="font-display text-2xl font-bold text-primary mb-3">
        {status === "working" && t("confirming")}
        {status === "success" && t("done")}
        {status === "error" && t("error")}
      </h1>
      <p className="text-muted-foreground max-w-sm mb-6">{message}</p>
      {status === "error" && (
        <Button onClick={() => navigate({ to: "/auth", search: { mode: "signin" } })} size="lg">
          Till inloggning
        </Button>
      )}
    </div>
  );
}
