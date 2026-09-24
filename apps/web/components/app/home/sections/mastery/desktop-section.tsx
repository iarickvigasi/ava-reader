import { useTranslations } from "next-intl";
import { Panel } from "../../shared/home-shared";
import { useMasteryChart } from "@/features/home/use-mastery-chart";
import type { useMasteryHistory } from "@/features/home/use-mastery-history";
import { HistoryChart } from "./history-chart";
import { MasteryGoalStatus } from "./goal-status";
import type { Mastery } from "./mastery-utils";

export function MasteryDesktopSection({
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
    <Panel className="hidden min-w-0 p-8 sm:block">
      <div className="flex h-full min-h-80 flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-[1.9rem] uppercase tracking-[0.04em] text-copy">
              {t("title")}
            </h2>
            <MasteryGoalStatus
              todayVisible={model.todayVisible}
              onToday={model.today}
              remainingCopy={remainingCopy}
              variant="desktop"
            />
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

        <div className="mt-4 min-h-0 flex-1">
          <div className="h-60">
            <HistoryChart
              mastery={mastery}
              history={history}
              model={model}
              variant="desktop"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
