import { useTranslations } from "next-intl";
import { Panel } from "../../shared/home-shared";
import { MasteryDayColumn } from "./day-column";
import type { Mastery } from "./mastery-utils";

export function MasteryDesktopSection({
  mastery,
  todayKey,
  remainingCopy,
  computeBarHeight,
}: {
  mastery: Mastery;
  todayKey: string | undefined;
  remainingCopy: string;
  computeBarHeight: (minutes: number) => number;
}) {
  const t = useTranslations("home.mastery");
  return (
    <Panel className="hidden p-8 sm:block">
      <div className="flex h-full min-h-80 flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-[1.9rem] uppercase tracking-[0.04em] text-copy">
              {t("title")}
            </h2>
            <p className="text-xl italic text-title">{remainingCopy}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl text-ink">
              {mastery.todayMinutes}/{mastery.dailyGoalMinutes}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {t("minToday")}
            </p>
          </div>
        </div>

        <div className="mt-8 min-h-0 flex-1">
          <div className="flex h-full items-end gap-2">
            {mastery.days.map((day) => (
              <MasteryDayColumn
                key={day.key}
                day={day}
                heightPercent={computeBarHeight(day.minutes)}
                isToday={day.key === todayKey}
                variant="desktop"
              />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
