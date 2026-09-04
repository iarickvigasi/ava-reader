"use client";

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
    void readAvatarBlob().then((blob) => {
      if (cancelled) {
        return;
      }
      if (!blob) {
        setResolved(null);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setResolved(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  return resolved;
}
