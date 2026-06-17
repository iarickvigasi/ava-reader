// Window-event bridge for the "this book is only partially saved offline" modal
// (see [[15-partial-offline-notice]]). Mirrors missing-book-bus: lets the modal
// live globally in <AppShell> while the reader (which has the chapter counts)
// triggers it, without coupling the two through the React tree.

export const PARTIAL_BOOK_EVENT = "ava-reader:partial-book";

export type PartialBookEventDetail = {
  libraryItemId: string;
  cachedChapterCount: number;
  totalChapterCount: number;
};

export function emitPartialBookOfflineModal(
  detail: PartialBookEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<PartialBookEventDetail>(PARTIAL_BOOK_EVENT, { detail }),
  );
}
