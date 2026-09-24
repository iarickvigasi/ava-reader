"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { getActiveUserId } from "../../db";
import { useNetworkState } from "../../net/use-network-state";
import {
  EMPTY_TRANSLATION_SNAPSHOT,
  getTranslationBucket,
  subscribeToTranslations,
} from "./bucket";
import { revalidateTranslationChapter } from "./sync";

export function useTranslationChapter(
  libraryItemId: string,
  chapterId: string | null,
  targetLang: string,
) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const tokenGetter = useRef(getToken);
  useEffect(() => {
    tokenGetter.current = getToken;
  }, [getToken]);
  const online = useNetworkState();
  const language = targetLang.trim();
  const getBucket = useCallback(
    () =>
      chapterId && language
        ? getTranslationBucket({
            libraryItemId,
            chapterId,
            targetLang: language,
          })
        : null,
    [libraryItemId, chapterId, language],
  );
  const getSnapshot = useCallback(
    () => getBucket()?.snapshot ?? EMPTY_TRANSLATION_SNAPSHOT,
    [getBucket],
  );
  const snapshot = useSyncExternalStore(
    subscribeToTranslations,
    getSnapshot,
    () => EMPTY_TRANSLATION_SNAPSHOT,
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled || getActiveUserId() !== userId) return;
      const bucket = getBucket();
      if (!bucket) return;
      bucket.getToken = async () => {
        const token = await tokenGetter.current();
        return getActiveUserId() === userId ? token : null;
      };
      // A reader activation may recover sentences saved by an abandoned request.
      return revalidateTranslationChapter(bucket, true);
    });
    return () => {
      cancelled = true;
    };
  }, [getBucket, isLoaded, isSignedIn, online, userId]);

  const retry = useCallback(() => {
    const bucket = getBucket();
    if (bucket) void revalidateTranslationChapter(bucket, true);
  }, [getBucket]);
  return { ...snapshot, retry };
}
