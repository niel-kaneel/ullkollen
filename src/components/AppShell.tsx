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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3">
        <SheepLogo className="w-9 h-9 text-primary" />
        <div>
          <div className="text-lg font-bold text-primary leading-tight">{t("appName")}</div>
        </div>
      </header>
      <main className={`flex-1 px-4 ${hideNav ? "pb-6" : "pb-28"}`}>{children}</main>
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-card">
          <div className="max-w-md mx-auto grid grid-cols-4">
            {items.map(({ to, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-xs ${active ? "font-semibold" : ""}`}>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
