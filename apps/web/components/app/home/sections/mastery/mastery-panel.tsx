import { useMasteryHistory } from "@/features/home/use-mastery-history";
import { useTranslations } from "next-intl";
import { MasteryDesktopSection } from "./desktop-section";
import { MasteryMobileSection } from "./mobile-section";
import { type Mastery } from "./mastery-utils";

export function MasteryPanel({ mastery }: { mastery: Mastery }) {
  const history = useMasteryHistory(
    mastery.days[0].key,
    mastery.dailyGoalMinutes,
  );
  const t = useTranslations("home.mastery");
  const remainingCopy =
    mastery.remainingMinutes > 0
      ? t("remainingToGoal", { remaining: mastery.remainingMinutes })
      : t("goalMet");

  return (
    <>
      <MasteryMobileSection
        history={history}
        mastery={mastery}
        remainingCopy={remainingCopy}
      />
      <MasteryDesktopSection
        history={history}
        mastery={mastery}
        remainingCopy={remainingCopy}
      />
    </>
  );
}
