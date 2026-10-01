/** Unknown totals have no percent bar: never present an invented quota. */
export function UsageMeter({
  label,
  value,
  total,
  display,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  display: string;
  hint?: string;
}) {
  const percent =
    total > 0 && Number.isFinite(value) && Number.isFinite(total)
      ? Math.min(100, Math.max(0, (value / total) * 100))
      : null;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{display}</span>
      </div>
      {percent !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={display}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {hint && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
