import { getDb } from "../../db";
import {
  abortInFlightExcept,
  clearInFlight,
  isCurrentInFlight,
  registerInFlight,
  setStatus,
} from "./bucket";
import { clearBookCompletion, deleteBookContent } from "./storage";

export type SaveOutcome =
  | { kind: "saved" }
  | { kind: "cancelled" }
  | { kind: "failed"; reason: string };

// Every response, write and cleanup belongs to the starting account and the
// registered save. Account changes or newer saves revoke that authority.
export function createDownloadScope(
  libraryItemId: string,
  signal?: AbortSignal,
) {
  const db = getDb();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  registerInFlight(libraryItemId, controller);
  abortInFlightExcept(libraryItemId);
  setStatus(libraryItemId, {
    status: "saving",
    currentChapters: 0,
    totalChapters: 0,
    error: null,
  });
  const owns = () =>
    getDb() === db && isCurrentInFlight(libraryItemId, controller);

  function assertOwned() {
    if (controller.signal.aborted || !owns())
      throw new DOMException("Aborted", "AbortError");
  }

  async function fail(
    error: unknown,
    preserveExistingBook: boolean,
  ): Promise<SaveOutcome> {
    const aborted =
      controller.signal.aborted ||
      getDb() !== db ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");
    if (aborted) {
      if (
        owns() &&
        (!preserveExistingBook || controller.signal.reason === "user-stop")
      ) {
        await db
          .transaction(
            "rw",
            [db.books, db.bookChapters, db.libraryItems, db.meta],
            async () => {
              if (owns()) await deleteBookContent(libraryItemId);
            },
          )
          .catch(() => {});
      }
      if (owns())
        setStatus(libraryItemId, {
          status: "idle",
          currentChapters: 0,
          totalChapters: 0,
          error: null,
        });
      return { kind: "cancelled" };
    }
    const reason =
      error instanceof Error ? error.message : "Unknown save error";
    if (owns()) {
      // Failure retains confirmed chapters for resume. Explicit Stop still
      // discards a partial download. Do not destroy a previously complete copy.
      if (!preserveExistingBook)
        await db
          .transaction("rw", [db.books, db.libraryItems, db.meta], async () => {
            if (owns()) await clearBookCompletion(libraryItemId);
          })
          .catch(() => {});
      if (owns()) setStatus(libraryItemId, { status: "failed", error: reason });
    }
    return { kind: "failed", reason };
  }

  return {
    db,
    signal: controller.signal,
    assertOwned,
    fail,
    release() {
      signal?.removeEventListener("abort", abort);
      clearInFlight(libraryItemId, controller);
    },
  };
}
