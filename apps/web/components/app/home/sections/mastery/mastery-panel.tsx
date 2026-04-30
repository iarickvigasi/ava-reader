import { MasteryDesktopSection } from "./desktop-section";
import { MasteryMobileSection } from "./mobile-section";
import {
  type Mastery,
  formatRemainingCopy,
  makeBarHeightCalculator,
} from "./mastery-utils";

export function MasteryPanel({ mastery }: { mastery: Mastery }) {
  const todayKey = mastery.days.at(-1)?.key;
  const computeBarHeight = makeBarHeightCalculator(mastery);
  const remainingCopy = formatRemainingCopy(mastery.remainingMinutes);

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
