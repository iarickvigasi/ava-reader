import { useTranslations } from "next-intl";
import Link from "next/link";
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
      <div className="flex items-end justify-between gap-4 border-b border-line/10 pb-4">
        <h2 className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted">
          <Link
            href="/app/insights"
            className="rounded-control transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
          >
            {t("title")}
          </Link>
        </h2>
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink">
          {mastery.todayMinutes} / {mastery.dailyGoalMinutes}{" "}
          {t("minutesAbbrev")}
        </span>
      </div>
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
