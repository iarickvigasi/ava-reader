import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { GOAL_BAR_HEIGHT_PERCENT, type MasteryDay } from "./mastery-utils";

export function MasteryDayColumn({
  day,
  heightPercent,
  isToday,
  variant,
}: {
  day: MasteryDay;
  heightPercent: number;
  isToday: boolean;
  variant: "mobile" | "desktop";
}) {
  const locale = useLocale();
  const isMobile = variant === "mobile";
  // `day.key` is an ISO date (YYYY-MM-DD). Append T00:00:00 so JS parses it
  // as local midnight and the weekday matches the user's calendar day.
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "short",
  }).format(new Date(`${day.key}T00:00:00`));

  return (
    <div
      className={cn(
        "grid h-full min-w-0 flex-1 grid-rows-[1fr_auto] items-end",
        isMobile ? "gap-1" : "gap-3",
      )}
    >
      <div className="relative flex h-full w-full items-end rounded-sm bg-transparent">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/45"
          style={{ bottom: `${GOAL_BAR_HEIGHT_PERCENT}%` }}
        />
        <div
          className={cn(
            "relative z-10 w-full transition",
            isMobile ? "rounded-t-xs" : "rounded-t-sm",
            getBarFillClass({ goalMet: day.goalMet, isToday }),
          )}
          style={{ height: `${heightPercent}%` }}
        />
      </div>
      <div className={cn("text-center", isMobile ? "space-y-0.5" : "space-y-1")}>
        <p
          className={cn(
            "uppercase text-muted",
            isMobile
              ? "text-[0.58rem] tracking-[0.12em]"
              : "text-xs tracking-[0.14em]",
          )}
        >
          {dayLabel}
        </p>
        <p className={cn("text-copy", isMobile ? "text-[0.7rem]" : "text-sm")}>
          {day.minutes}m
        </p>
      </div>
    </div>
  );
}

function getBarFillClass({
  goalMet,
  isToday,
}: {
  goalMet: boolean;
  isToday: boolean;
}) {
  if (isToday) return "bg-brand-fill";
  return goalMet ? "bg-ink" : "bg-sand";
}
