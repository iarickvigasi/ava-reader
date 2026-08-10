// Collection names are unique per user (@@unique([userId, name])), so a default
// smart collection whose canonical name a user already gave a CUSTOM collection
// would fail to insert and take the whole import transaction with it. Same
// shape as resolveUniqueSlug, but suffixed for display rather than for a URL —
// the smart collections render a localized name from their smartKey anyway, so
// a suffixed stored name stays invisible.

export async function resolveUniqueCollectionName(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
) {
  if (!(await isTaken(base))) {
    return base;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} (${suffix})`;

    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
}
