import { Link, useLocation } from "@tanstack/react-router";
import { Home, Sheet, Scissors, User } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { SheepLogo } from "./SheepLogo";

export function AppShell({ children, hideNav = false }: { children: React.ReactNode; hideNav?: boolean }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const path = loc.pathname;

  const items = [
    { to: "/app", label: t("home"), icon: Home, match: (p: string) => p === "/app" },
    { to: "/app/flock", label: t("flock"), icon: Sheet, match: (p: string) => p.startsWith("/app/flock") },
    { to: "/app/shearers", label: t("shearers"), icon: Scissors, match: (p: string) => p.startsWith("/app/shearers") },
    { to: "/app/profile", label: t("profile"), icon: User, match: (p: string) => p.startsWith("/app/profile") },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-5 pt-5 pb-4 flex items-center gap-3">
        <div className="p-1.5 rounded-2xl bg-card border border-border shadow-soft">
          <SheepLogo className="w-7 h-7 text-primary" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold leading-none">
            {t("tagline")?.split(".")?.[0]}
          </div>
          <div className="font-display text-xl font-bold text-primary leading-tight mt-0.5">
            {t("appName")}
          </div>
        </div>
      </header>
      <main className={`flex-1 px-4 ${hideNav ? "pb-6" : "pb-28"}`}>{children}</main>
      {!hideNav && (
        <nav className="fixed bottom-3 left-3 right-3 max-w-md mx-auto bg-card/95 backdrop-blur border border-border rounded-3xl shadow-card">
          <div className="grid grid-cols-4">
            {items.map(({ to, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <span className="absolute top-1 w-8 h-1 rounded-full bg-primary" />
                  )}
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
