import type { HomePayload } from "@/lib/api-types/home";
import { isOlderReadingSnapshot } from "../../stats/is-older-reading-snapshot";

export function retainNewerReading(
  incoming: HomePayload,
  current?: HomePayload,
) {
  if (
    !current ||
    !isOlderReadingSnapshot(incoming.readingSnapshot, current.readingSnapshot)
  )
    return incoming;
  return {
    ...incoming,
    readingSnapshot: current.readingSnapshot,
    stats: { ...incoming.stats, hoursReading: current.stats.hoursReading },
    mastery: current.mastery,
  };
}
