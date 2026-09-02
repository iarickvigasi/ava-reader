type EngagementTimestamps = {
  addedAt: Date;
  lastOpenedAt: Date | null;
  progress: { lastReadAt: Date | null } | null;
};

// Engagement recency — the sort key for every book list (library overview,
// collection pages, home's current book). See docs/specs/3-library/_overview.md.
export function mostRecentEngagementDate(item: EngagementTimestamps): Date {
  const lastReadAtMs = item.progress?.lastReadAt?.getTime() ?? 0;
  const lastOpenedAtMs = item.lastOpenedAt?.getTime() ?? 0;
  const addedAtMs = item.addedAt.getTime();

  return new Date(Math.max(lastReadAtMs, lastOpenedAtMs, addedAtMs));
}

export function compareByEngagementDesc(
  left: EngagementTimestamps,
  right: EngagementTimestamps,
): number {
  return (
    mostRecentEngagementDate(right).getTime() -
    mostRecentEngagementDate(left).getTime()
  );
}
