// The offline decision for a "read this book" link. A pure async seam (mirrors
// resolve-offline-card / header-chip-state) so the component reads cache state
// FRESH at click time.

export type OfflineReadAction = "navigate" | "missing";

export async function resolveOfflineReadAction(
  libraryItemId: string,
  hasContent: (id: string) => Promise<boolean>,
): Promise<OfflineReadAction> {
  return (await hasContent(libraryItemId)) ? "navigate" : "missing";
}
