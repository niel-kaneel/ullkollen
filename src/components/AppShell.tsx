import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, Scissors, User, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { SheepLogo } from "./SheepLogo";
import { haptic } from "@/lib/haptics";

export function AppShell({ children, hideNav = false }: { children: React.ReactNode; hideNav?: boolean }) {
  const { t, lang } = useTranslation();
  const loc = useLocation();
  const path = loc.pathname;

  const items = [
    { to: "/app", label: t("home"), icon: Home, match: (p: string) => p === "/app" },
    { to: "/app/flock", label: t("flock"), icon: Users, match: (p: string) => p.startsWith("/app/flock") },
    { to: "/app/shearers", label: t("shearers"), icon: Scissors, match: (p: string) => p.startsWith("/app/shearers") },
    { to: "/app/profile", label: t("profile"), icon: User, match: (p: string) => p.startsWith("/app/profile") },
  ];

  // Split items: 2 left of FAB, 2 right of FAB
  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2);
  const classifyActive = path.startsWith("/app/classify");

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
      <main className={`flex-1 px-4 ${hideNav ? "pb-6" : "pb-32"}`}>{children}</main>
      {!hideNav && (
        <nav
          className="fixed bottom-3 left-3 right-3 max-w-md mx-auto bg-card/95 backdrop-blur border border-border rounded-3xl shadow-card"
          aria-label={lang === "sv" ? "Primär navigation" : "Primary navigation"}
        >
          <div className="relative grid grid-cols-5 items-end">
            {leftItems.map(({ to, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {active && <span className="absolute top-1 w-8 h-1 rounded-full bg-primary" />}
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{label}</span>
                </Link>
              );
            })}

            {/* Center FAB — Klassa */}
            <div className="flex flex-col items-center justify-end pb-1">
              <Link
                to="/app/classify"
                onClick={() => haptic("tap")}
                aria-label={t({ sv: "Ny klassificering", en: "New classification" })}
                className={`-mt-7 w-16 h-16 rounded-full flex items-center justify-center text-primary-foreground shadow-card border-4 border-background transition active:scale-95 ${
                  classifyActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ background: "var(--gradient-pine)" }}
              >
                <Plus className="w-7 h-7" strokeWidth={3} />
              </Link>
              <span
                className={`text-[10px] mt-1 ${
                  classifyActive ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {t({ sv: "Klassa", en: "Classify" })}
              </span>
            </div>

            {rightItems.map(({ to, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] transition ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {active && <span className="absolute top-1 w-8 h-1 rounded-full bg-primary" />}
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
