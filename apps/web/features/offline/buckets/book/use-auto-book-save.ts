import { useEffect, useRef } from "react";
import type { BookSaveStatus } from "./bucket";
import type { SaveOutcome } from "./download";

type Input = {
  libraryItemId: string;
  ownerId: string | null | undefined;
  hasCached: boolean | null;
  online: boolean;
  saveStatus: BookSaveStatus;
  save: (kind: "auto" | "explicit") => Promise<SaveOutcome>;
};

// A failed download stays failed until explicit retry, reconnect or a new book.
export function useAutoBookSave({
  libraryItemId,
  ownerId,
  hasCached,
  online,
  saveStatus,
  save,
}: Input) {
  const attempted = useRef({ scope: "", started: false });
  useEffect(() => {
    const scope = `${ownerId}:${libraryItemId}`;
    if (attempted.current.scope !== scope || !online)
      attempted.current = { scope, started: false };
    if (
      !ownerId ||
      hasCached !== false ||
      !online ||
      attempted.current.started ||
      saveStatus === "saving" ||
      saveStatus === "saved"
    )
      return;
    // Fence before dispatch: synchronous status listeners and changed closures
    // cannot start another automatic save in this owner/book online epoch.
    attempted.current.started = true;
    void save("auto");
  }, [libraryItemId, ownerId, hasCached, online, saveStatus, save]);
}
