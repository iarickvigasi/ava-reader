import { createRestoreIntent } from "../navigation";
import type {
  ReaderModeRestoreInput,
  ReaderModeRestoreState,
} from "./mode-restore-types";

/** A renderer remount gets a fresh locator restore only on a reading-mode change. */
export function resolveReaderModeRestore(
  previous: ReaderModeRestoreState | null,
  input: ReaderModeRestoreInput,
): ReaderModeRestoreState {
  const {
    isBilingual,
    libraryItemId,
    activeChapterId,
    restoreIntent,
    visibleLocator,
  } = input;
  const parentRestoreKey = restoreIntent?.key ?? null;
  const parentRestoreChapterId = restoreIntent?.chapterId ?? null;
  const navigationChanged =
    previous !== null &&
    (previous.libraryItemId !== libraryItemId ||
      previous.activeChapterId !== activeChapterId ||
      previous.parentRestoreKey !== parentRestoreKey ||
      previous.parentRestoreChapterId !== parentRestoreChapterId);
  const modeChanged = previous !== null && previous.isBilingual !== isBilingual;
  const currentLocator =
    visibleLocator?.chapterId === activeChapterId ? visibleLocator : null;
  const latestLocator =
    currentLocator ??
    (navigationChanged ? null : (previous?.latestLocator ?? null));
  const locatorChanged =
    latestLocator?.chapterId !== previous?.latestLocator?.chapterId ||
    latestLocator?.blockId !== previous?.latestLocator?.blockId ||
    latestLocator?.textOffset !== previous?.latestLocator?.textOffset;
  if (previous && !modeChanged && !navigationChanged && !locatorChanged)
    return previous;

  const cycle = (previous?.cycle ?? 0) + Number(modeChanged);
  let override = navigationChanged ? null : (previous?.override ?? null);
  // Explicit parent navigation takes precedence when navigation and mode change
  // together. Otherwise replace the old bootstrap/edge restore with the anchor.
  if (modeChanged && !navigationChanged && latestLocator) {
    override = createRestoreIntent(
      activeChapterId,
      latestLocator,
      `mode:${libraryItemId}:${cycle}:${isBilingual ? "bilingual" : "original"}`,
    );
  }
  return {
    isBilingual,
    libraryItemId,
    activeChapterId,
    parentRestoreKey,
    parentRestoreChapterId,
    cycle,
    latestLocator,
    override,
  };
}
