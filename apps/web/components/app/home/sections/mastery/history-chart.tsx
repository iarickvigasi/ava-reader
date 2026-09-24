import styles from "./history-chart.module.css";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { useMasteryChart } from "@/features/home/use-mastery-chart";
import type { useMasteryHistory } from "@/features/home/use-mastery-history";
import { MasteryDayColumn } from "./day-column";
import { HistoryPlaceholder } from "./history-placeholder";
import { makeBarHeightCalculator, type Mastery } from "./mastery-utils";

export function HistoryChart({
  mastery,
  history,
  model,
  variant,
}: {
  mastery: Mastery;
  model: ReturnType<typeof useMasteryChart>;
  history: ReturnType<typeof useMasteryHistory>;
  variant: "mobile" | "desktop";
}) {
  const t = useTranslations("home.mastery");
  const {
    attach,
    onScroll,
    move,
    days,
    placeholderDays,
    todayKey,
    range,
    atStart,
    atToday,
  } = model;
  const height = makeBarHeightCalculator(mastery);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <Button
          size="sm"
          className="min-h-5!"
          variant="ghost"
          aria-label={t("previousWeek")}
          disabled={atStart}
          onClick={() => move(-1)}
        >
          ←
        </Button>
        <span className="text-center">{range}</span>
        <Button
          size="sm"
          className="min-h-5!"
          variant="ghost"
          aria-label={t("nextWeek")}
          disabled={atToday}
          onClick={() => move(1)}
        >
          →
        </Button>
      </div>
      <div
        ref={attach}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label={t("title")}
        style={{ scrollbarWidth: "none" }}
        className={`${styles.timeline} flex min-h-28 min-w-0 flex-1 overscroll-x-contain [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-line-strong`}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {history.hasMore && (
          <HistoryPlaceholder
            status={history.status}
            days={placeholderDays}
            variant={variant}
          />
        )}
        {days.map((day) => (
          <div
            key={day.key}
            className="h-full min-h-28 shrink-0 basis-[calc(100%/7)] px-1"
          >
            <MasteryDayColumn
              day={day}
              heightPercent={height(day.minutes)}
              isToday={day.key === todayKey}
              variant={variant}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
