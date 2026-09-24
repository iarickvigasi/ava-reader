import { useTranslations } from "next-intl";
import { SectionHeader } from "../../shared/home-shared";
import { useMasteryChart } from "@/features/home/use-mastery-chart";
import type { useMasteryHistory } from "@/features/home/use-mastery-history";
import { HistoryChart } from "./history-chart";
import { MasteryGoalStatus } from "./goal-status";
import type { Mastery } from "./mastery-utils";

export function MasteryMobileSection({
  mastery,
  history,
  remainingCopy,
}: {
  mastery: Mastery;
  history: ReturnType<typeof useMasteryHistory>;
  remainingCopy: string;
}) {
  const model = useMasteryChart(mastery, history);
  const t = useTranslations("home.mastery");
  return (
    <section className="min-w-0 space-y-3 sm:hidden">
      <SectionHeader
        label={t("title")}
        action={
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink">
            {mastery.todayMinutes} / {mastery.dailyGoalMinutes}{" "}
            {t("minutesAbbrev")}
          </span>
        }
      />
      <div className="space-y-5">
        <div className="h-44">
          <HistoryChart
            mastery={mastery}
            history={history}
            model={model}
            variant="mobile"
          />
        </div>
        <MasteryGoalStatus
          todayVisible={model.todayVisible}
          onToday={model.today}
          remainingCopy={remainingCopy}
          variant="mobile"
        />
      </div>
    </section>
  );
}
