"use client";

// Thin "use client" wrappers around the existing StatsPanel + MasteryPanel
// that augment their props with the stats composer's live deltas. Lets the
// surrounding HomeScreen stay a server component while the panels receive
// values that reflect offline reading time / pending highlights / locally-
// completed books.

import type { HomePayload } from "@/lib/api-types";
import {
  useComposedHomeStats,
  useComposedMastery,
} from "@/features/offline/stats";

import { MasteryPanel } from "./mastery/mastery-panel";
import { StatsPanel } from "./stats-panel";

export function StatsPanelWithDeltas({ home }: { home: HomePayload }) {
  const stats = useComposedHomeStats(home) ?? home.stats;
  return <StatsPanel stats={stats} />;
}

export function MasteryPanelWithDeltas({ home }: { home: HomePayload }) {
  const mastery = useComposedMastery(home) ?? home.mastery;
  return <MasteryPanel mastery={mastery} />;
}
