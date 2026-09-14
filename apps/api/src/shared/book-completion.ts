type CompletionSource = {
  finishedAt: Date | null;
  progress: { completionPercent: number } | null;
};

// A recorded finish date and reader completion are independent signals. A
// book satisfying both is still one finished book.
export function isBookFinished(item: CompletionSource): boolean {
  return (
    item.finishedAt != null || (item.progress?.completionPercent ?? 0) >= 100
  );
}

// Aggregate snapshots include every contributing item, even when the UI only
// receives a few preview cards. The client can then reconcile offline edits
// against the same state the server counted.
export function serializeCompletionItem(
  item: CompletionSource & { id: string },
) {
  return {
    libraryItemId: item.id,
    finishedAt: item.finishedAt?.toISOString() ?? null,
    completionPercent: item.progress?.completionPercent ?? 0,
  };
}
