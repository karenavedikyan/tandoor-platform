import { cn } from "@/lib/utils";
import { tpStateSegmentBarClass, type TpStateSegmentRow } from "@/lib/trade-points-overview-view-model";

type Props = {
  segments: TpStateSegmentRow[];
  total: number;
  className?: string;
  "data-testid"?: string;
};

export function TradePointsTpStateMiniBar({ segments, total, className, "data-testid": testId }: Props) {
  const denom = Math.max(1, total);
  if (segments.length === 0) {
    return (
      <p className={cn("text-[10px] text-muted-foreground", className)} data-testid={testId}>
        нет точек
      </p>
    );
  }

  return (
    <div
      className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      data-testid={testId}
      role="img"
      aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}
    >
      {segments.map((seg) => {
        const pct = Math.max(4, Math.round((seg.count / denom) * 100));
        return (
          <span
            key={seg.key}
            className={cn("h-full shrink-0", tpStateSegmentBarClass(seg.key))}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        );
      })}
    </div>
  );
}
