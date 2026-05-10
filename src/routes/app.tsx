import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    // Only check session on the client — localStorage is unavailable during SSR,
    // so a server-side check would always fail and redirect users to /auth on every
    // fresh app open even when they have a valid persisted session.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !profileLoading && user && !profile) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, profileLoading, user, profile, navigate]);

  if (loading || profileLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">...</div>;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
