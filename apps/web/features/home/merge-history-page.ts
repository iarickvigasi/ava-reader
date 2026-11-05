import { isOlderReadingSnapshot } from "@/features/offline/stats/is-older-reading-snapshot";
import type { MasteryHistoryPage } from "./types";

export function mergeHistoryPage(
  pages: MasteryHistoryPage[],
  incoming: MasteryHistoryPage,
) {
  const key = incoming.days[0]?.key;
  const existing = pages.find((page) => page.days[0]?.key === key);
  if (existing && isOlderReadingSnapshot(incoming, existing)) return pages;
  return [incoming, ...pages.filter((page) => page.days[0]?.key !== key)].sort(
    (left, right) => left.days[0].key.localeCompare(right.days[0].key),
  );
}
