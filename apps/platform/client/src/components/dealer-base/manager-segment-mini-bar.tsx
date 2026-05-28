import { cn } from "@/lib/utils";
import { dealerBaseSegmentBarClass, type DealerBaseSegmentRow } from "@/lib/dealer-base-dealer-segment";

type Props = {
  segments: DealerBaseSegmentRow[];
  total: number;
  className?: string;
  "data-testid"?: string;
};

export function ManagerSegmentMiniBar({ segments, total, className, "data-testid": testId }: Props) {
  const denom = Math.max(1, total);
  if (segments.length === 0) {
    return (
      <div
        className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
        data-testid={testId}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      data-testid={testId}
      role="img"
      aria-label={`Сегментация: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}
    >
      {segments.map((seg) => {
        const pct = Math.max(4, Math.round((seg.count / denom) * 100));
        return (
          <span
            key={seg.key}
            className={cn("h-full shrink-0", dealerBaseSegmentBarClass(seg.key))}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        );
      })}
    </div>
  );
}
