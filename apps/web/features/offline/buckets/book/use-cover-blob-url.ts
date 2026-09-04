"use client";

import { useEffect, useState } from "react";

import { readCoverBlob } from "./storage";

// The Dexie-cached cover for a personal-library book — checked first, ahead
// of the network (see use-book-cover-src.ts). Three states, since "resolving"
// and "confirmed absent" must read differently to the caller (the former
// waits; the latter falls back to network):
//   - no `libraryItemId` (no personal-library id — a public/catalog cover):
//     `null`, synchronously — nothing to look up.
//   - an id was given but the Dexie read for it hasn't resolved yet:
//     `undefined`.
//   - resolved: the object URL, or `null` once confirmed there's no blob.
//
// `resolved` is keyed by the id it was resolved for, so a stale result never
// leaks out when `libraryItemId` changes before the read for it resolves —
// mirrors how BookCover keys `measured` off the src it was measured for.
export function useCoverBlobUrl(
  libraryItemId: null | string,
): string | null | undefined {
  const [resolved, setResolved] = useState<{
    id: string;
    url: null | string;
  } | null>(null);

  useEffect(() => {
    if (!libraryItemId) {
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void readCoverBlob(libraryItemId).then((blob) => {
      if (cancelled) {
        return;
      }
      if (!blob) {
        setResolved({ id: libraryItemId, url: null });
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setResolved({ id: libraryItemId, url: objectUrl });
    });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [libraryItemId]);

  if (!libraryItemId) {
    return null;
  }
  return resolved?.id === libraryItemId ? resolved.url : undefined;
}
