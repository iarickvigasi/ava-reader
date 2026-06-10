import type { SaveOutcome } from "./download";

// Whether an offline-save failure warrants a user-facing error toast.
// - Auto-saves (triggered by simply opening a book) are a silent background
//   convenience — their failure must never toast, or every book-open while
//   offline nags "Couldn't save this book offline" on each navigation.
// - Explicit saves (the user tapped "Save offline") toast only when genuinely
//   online; offline the intent is queued and resumes on reconnect, so an error
//   would be misleading.
// `online` must come from the app's net-state, not `navigator.onLine` (which is
// unreliably `true` when actually offline — see ../../net-state).
export function shouldToastSaveFailure(
  outcome: SaveOutcome,
  kind: "auto" | "explicit",
  online: boolean,
): boolean {
  return outcome.kind === "failed" && kind === "explicit" && online;
}
