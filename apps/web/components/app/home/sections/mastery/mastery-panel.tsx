import { useTranslations } from "next-intl";
import { MasteryDesktopSection } from "./desktop-section";
import { MasteryMobileSection } from "./mobile-section";
import { type Mastery, makeBarHeightCalculator } from "./mastery-utils";

export function MasteryPanel({ mastery }: { mastery: Mastery }) {
  const t = useTranslations("home.mastery");
  const todayKey = mastery.days.at(-1)?.key;
  const computeBarHeight = makeBarHeightCalculator(mastery);
  const remainingCopy =
    mastery.remainingMinutes > 0
      ? t("remainingToGoal", { remaining: mastery.remainingMinutes })
      : t("goalMet");

  return (
    <>
      <MasteryMobileSection
        mastery={mastery}
        todayKey={todayKey}
        remainingCopy={remainingCopy}
        computeBarHeight={computeBarHeight}
      />
      <MasteryDesktopSection
        mastery={mastery}
        todayKey={todayKey}
        remainingCopy={remainingCopy}
        computeBarHeight={computeBarHeight}
      />
    </>
  );
}
