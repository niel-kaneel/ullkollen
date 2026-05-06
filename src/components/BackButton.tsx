import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function BackButton({ to = "/app" as string, label }: { to?: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 py-1"
    >
      <ArrowLeft className="w-4 h-4" />
      {label ?? t("back")}
    </Link>
  );
}
