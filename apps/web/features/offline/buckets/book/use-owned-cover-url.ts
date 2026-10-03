"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { getActiveUserId } from "../../db";
import { loadOwnedCover } from "./load-owned-cover";
export function useOwnedCoverUrl(libraryItemId: string | null, src: string) {
  const { userId, getToken } = useOfflineAuth();
  const owner = userId ?? getActiveUserId();
  const key = JSON.stringify([owner, libraryItemId, src]);
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!owner || owner !== getActiveUserId() || !libraryItemId) return;
    const controller = new AbortController();
    let url: string | undefined;
    void loadOwnedCover({
      libraryItemId,
      src,
      getToken,
      signal: controller.signal,
    })
      .then((blob) => {
        if (controller.signal.aborted || owner !== getActiveUserId()) return;
        url = URL.createObjectURL(blob);
        setResolved({ key, url });
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [owner, libraryItemId, src, getToken, key]);
  return owner === getActiveUserId() && resolved?.key === key
    ? resolved.url
    : null;
}
