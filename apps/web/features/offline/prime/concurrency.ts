// Bounded-concurrency map used by the metadata-tier primer to fan out per-book
// revalidations without firing N requests at once. A worker that throws drops
// that item silently — the primer treats per-item failures as best-effort and
// the once-per-device completion flag only commits on a fully clean pass.
//
// `shouldContinue` is checked before each item is picked up; when it returns
// false (e.g. we went offline) the remaining items are skipped.

export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldContinue: () => boolean = () => true,
): Promise<{ completed: number; aborted: boolean }> {
  let cursor = 0;
  let completed = 0;
  let aborted = false;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));

  async function runner(): Promise<void> {
    while (true) {
      if (!shouldContinue()) {
        aborted = true;
        return;
      }
      const index = cursor++;
      if (index >= items.length) {
        return;
      }
      try {
        await worker(items[index]!, index);
        completed += 1;
      } catch {
        // Best-effort: one item's failure shouldn't sink the batch. The
        // caller decides whether a partial pass is "done" via `completed`.
      }
    }
  }

  await Promise.all(
    Array.from({ length: effectiveLimit }, () => runner()),
  );

  return { completed, aborted };
}
