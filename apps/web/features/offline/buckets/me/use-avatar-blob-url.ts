"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";

import { readAvatarBlob } from "./storage";

// The Dexie-cached avatar photo — checked first, ahead of the network (see
// UserAvatarFallback). Mirrors buckets/book/use-cover-blob-url.ts, minus the
// id: there's only ever one "me" row per database, so no keying is needed.
// `undefined` while the read is unresolved, `null` once confirmed absent,
// else the object URL.
export function useAvatarBlobUrl(): string | null | undefined {
  const [resolved, setResolved] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const subscription = liveQuery(readAvatarBlob).subscribe({
      next: (blob) => {
        if (cancelled) {
          return;
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (!blob) {
          setResolved(null);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      },
      error: () => setResolved(null),
    });
    return () => {
      subscription.unsubscribe();
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  return resolved;
}
