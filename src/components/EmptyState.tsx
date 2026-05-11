import type { ReactNode } from "react";

type Props = {
  emoji?: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ emoji, icon, title, description, action, className = "" }: Props) {
  return (
    <div
      className={`bg-card border border-dashed border-border rounded-3xl p-8 text-center flex flex-col items-center gap-3 ${className}`}
    >
      {emoji ? (
        <div className="text-5xl" aria-hidden>
          {emoji}
        </div>
      ) : icon ? (
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-primary">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1 max-w-xs">
        <h3 className="font-display text-lg font-bold text-primary">{title}</h3>
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
