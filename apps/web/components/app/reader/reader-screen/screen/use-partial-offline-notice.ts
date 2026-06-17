// Reader hook: when a book is opened offline and only partially cached (some
// chapters from a prior auto-save, not explicitly saved), fire the partial-book
// event so the global modal can surface it. See [[15-partial-offline-notice]].
// The decision is the pure `shouldShowPartialOfflineNotice`; this hook just
// gathers its inputs from Dexie + net-state.

import { useEffect } from "react";

import {
  readCachedChapterIds,
  readOfflineState,
} from "@/features/offline/buckets/book/storage";
import { shouldShowPartialOfflineNotice } from "@/features/offline/buckets/book/partial-offline";
import { emitPartialBookOfflineModal } from "@/features/offline/notices/partial-book-bus";
import { useNetworkState } from "@/features/offline/net/use-network-state";

export function usePartialOfflineNotice(input: {
  libraryItemId: string;
  totalChapterCount: number;
}): void {
  const { libraryItemId, totalChapterCount } = input;
  const online = useNetworkState();

  useEffect(() => {
    // Online, the auto-save is already completing the download — nothing to warn
    // about. Only evaluate while offline.
    if (online) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [offlineDetail, cachedIds] = await Promise.all([
        readOfflineState(libraryItemId),
        readCachedChapterIds(libraryItemId),
      ]);
      if (cancelled) {
        return;
      }
      const cachedChapterCount = cachedIds.size;
      if (
        shouldShowPartialOfflineNotice({
          online: false,
          offlineState: offlineDetail.state,
          cachedChapterCount,
          totalChapterCount,
        })
      ) {
        emitPartialBookOfflineModal({
          libraryItemId,
          cachedChapterCount,
          totalChapterCount,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, libraryItemId, totalChapterCount]);
}
