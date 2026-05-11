import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Where the back arrow points. Pass `false` to hide (use on root tabs). Defaults to "/app". */
  back?: string | false;
  backLabel?: string;
  icon?: ReactNode;
  /** Right-aligned action(s). */
  action?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  back = "/app",
  backLabel,
  icon,
  action,
}: PageHeaderProps) {
  const { t } = useTranslation();
  const showBack = back !== false;

  return (
    <header className="space-y-2 pt-1">
      {showBack && (
        <Link
          to={back as string}
          onClick={() => haptic("tap")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel ?? t("back")}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-primary leading-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 flex items-center gap-1">{action}</div>}
      </div>
    </header>
  );
}
