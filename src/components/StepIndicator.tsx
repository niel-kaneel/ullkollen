type Props = {
  current: number; // 1-indexed
  total: number;
  labels?: string[];
};

export function StepIndicator({ current, total, labels }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }).map((_, i) => {
          const step = i + 1;
          const reached = step <= current;
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                reached ? "bg-primary" : "bg-secondary"
              }`}
            />
          );
        })}
      </div>
      {labels && (
        <div className="flex justify-between text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          {labels.map((l, i) => (
            <span key={i} className={i + 1 === current ? "text-primary" : ""}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
