"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { emitAppToast } from "@/components/app/core/app-toast";
import { getPublicApiBaseUrl } from "@/lib/api";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { useSyncTriggers } from "@/features/offline/net/use-sync-triggers";
import type { AnnotationKind, AnnotationLoadStatus } from "./annotation-sources";
import { loadAnnotations } from "./load-annotations";

export function useAnnotationLoad(libraryItemId: string, kind: AnnotationKind) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const apiBaseUrl = getPublicApiBaseUrl();
  const online = useNetworkState();
  const t = useTranslations("library.bookInfo.annotations");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; status: AnnotationLoadStatus }>();
  const key = `${kind}:${libraryItemId}:${apiBaseUrl}:${online}:${isLoaded}:${isSignedIn}:${attempt}`;
  const refetch = useCallback(() => setAttempt((current) => current + 1), []);
  const currentToken = useEffectEvent(() => getToken());
  const reportFailure = useEffectEvent(() => {
    emitAppToast({ tone: "warning", message: t("loadFailed") });
  });

  useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    void loadAnnotations({
      libraryItemId, kind, apiBaseUrl, online: online && !!isSignedIn,
      getToken: currentToken, signal: controller.signal,
    }).then(() => {
      if (!controller.signal.aborted) setResult({ key, status: "ready" });
    }).catch(() => {
      if (controller.signal.aborted) return;
      setResult({ key, status: "error" });
      reportFailure();
    });
    return () => controller.abort();
  }, [apiBaseUrl, isLoaded, isSignedIn, key, kind, libraryItemId, online]);

  useSyncTriggers(isLoaded && isSignedIn ? refetch : null);
  const loadStatus: AnnotationLoadStatus = result?.key === key ? result.status : "loading";
  return { loadStatus, refetch };
}
