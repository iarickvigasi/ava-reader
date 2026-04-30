import { SectionHeader } from "../../shared/home-shared";
import { MasteryDayColumn } from "./day-column";
import type { Mastery } from "./mastery-utils";

export function MasteryMobileSection({
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
  return (
    <section className="space-y-6 sm:hidden">
      <SectionHeader
        label="Daily Mastery"
        action={
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink">
            {mastery.todayMinutes} / {mastery.dailyGoalMinutes} MIN
          </span>
        }
      />
      <div className="space-y-5">
        <div className="flex h-28 items-end gap-1">
          {mastery.days.map((day) => (
            <MasteryDayColumn
              key={day.key}
              day={day}
              heightPercent={computeBarHeight(day.minutes)}
              isToday={day.key === todayKey}
              variant="mobile"
            />
          ))}
        </div>
        <p className="text-center font-display text-xl italic text-title">
          {remainingCopy}
        </p>
      </div>
    </section>
  );
}
