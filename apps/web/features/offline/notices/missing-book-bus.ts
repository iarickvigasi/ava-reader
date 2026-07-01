// Window-event bridge for the "this book isn't saved offline" modal. Lets
// the modal live globally in <AppShell> and be triggered from anywhere on
// the client — link interceptors before navigation, the reader page on
// arrival, or any future surface — without coupling the publishers to
// React tree topology.

export const MISSING_BOOK_EVENT = "ava-reader:missing-book";

export type MissingBookEventDetail = {
  libraryItemId: string;
};

export function emitMissingBookOfflineModal(
  detail: MissingBookEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<MissingBookEventDetail>(MISSING_BOOK_EVENT, { detail }),
  );
}
