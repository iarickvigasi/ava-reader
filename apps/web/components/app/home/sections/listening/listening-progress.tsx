import { cn } from "@/lib/cn";

// A bar this thin reads as empty at low percentages, so the fill keeps a floor.
const PROGRESS_MIN_PERCENT = 8;

export function ListeningProgress({
  className,
  progressPercent,
}: {
  className?: string;
  progressPercent: number;
}) {
  const progressWidth = Math.max(progressPercent, PROGRESS_MIN_PERCENT);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-copy">
        <span>15:20</span>
        <span>42:10</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line/20 sm:h-2">
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}
