"use client";

import { useEffect, useState } from "react";

import { readCoverBlob } from "./storage";

// Object URL for a book's offline-saved cover — the fallback BookCover
// reaches for once the network cover has failed. `libraryItemId` is passed
// as `null` while that fallback isn't wanted (network cover still loading or
// fine), so a healthy cover never pays for a Dexie read. Null while there's
// no saved blob, or once one is confirmed absent.
//
// `found` is keyed by the id it was resolved for, so a stale URL never leaks
// out when `libraryItemId` changes (a different failure, or the fallback
// switching off) before the read for it resolves — mirrors how BookCover
// itself keys `measured` off the src it was measured for.
export function useCoverBlobUrl(libraryItemId: null | string): string | null {
  const [found, setFound] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!libraryItemId) {
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void readCoverBlob(libraryItemId).then((blob) => {
      if (cancelled || !blob) {
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setFound({ id: libraryItemId, url: objectUrl });
    });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [libraryItemId]);

  return found?.id === libraryItemId ? found.url : null;
}
