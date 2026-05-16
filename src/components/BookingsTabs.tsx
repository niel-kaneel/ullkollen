import { Link } from "@tanstack/react-router";
import { List, Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

type Tab = "list" | "calendar";

export function BookingsTabs({ active }: { active: Tab }) {
  const { lang } = useTranslation();
  const tabs: { id: Tab; to: string; label: string; icon: typeof List }[] = [
    { id: "list", to: "/app/bookings", label: t({ sv: "Lista", en: "List" }), icon: List },
    { id: "calendar", to: "/app/calendar", label: t({ sv: "Kalender", en: "Calendar" }), icon: CalendarIcon },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/60 rounded-2xl">
      {tabs.map((t) => {
        const isActive = t.id === active;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            to={t.to}
            onClick={() => haptic("tap")}
            className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-semibold transition ${
              isActive
                ? "bg-card text-primary shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
