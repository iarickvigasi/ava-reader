// Shared read path for the generic-shell loaders (ADR 4): Dexie first; on a
// miss while online, revalidate once and re-read. A cache hit never
// revalidates here — the screen's hydrator (useHydrateBookInfo /
// useHydrateCollection) owns online freshness, and doubling the request would
// be wasteful. Offline never touches the network.

export type ReadWithRevalidateDeps<T> = {
  isOnline: () => boolean;
  read: () => Promise<T | null>;
  revalidate: () => Promise<void>;
};

export async function readWithRevalidate<T>(
  deps: ReadWithRevalidateDeps<T>,
): Promise<T | null> {
  const cached = await deps.read();
  if (cached) {
    return cached;
  }
  if (!deps.isOnline()) {
    return null;
  }
  await deps.revalidate();
  return deps.read();
}
