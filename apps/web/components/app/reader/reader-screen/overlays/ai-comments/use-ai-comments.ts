import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { AiCommentLocator } from "@/lib/api-types";
import { emitReaderToast } from "../reader-toast";

// One row from GET /api/library/:libraryItemId/ai-comments. Mirrors the
// `AiCommentListItem` shape on the server. Locator is parsed by the server
// and arrives as a structured object (or null for old rows / parse failures).
export type AiCommentRecord = {
  id: string;
  kind: "TRANSLATE" | "ETYMOLOGY" | "EXPLAIN";
  sourceText: string;
  body: string;
  targetLang: string | null;
  locator: AiCommentLocator | null;
  createdAt: string;
};

type UseAiCommentsResult = {
  comments: AiCommentRecord[];
  refetch: () => void;
};

// Fetches the persisted AI-comment list for a library item. The reader uses
// these to paint <mark> highlights over the source text on every page so the
// user can find their own annotations on a re-read. Failures are non-blocking:
// the reader still works without highlights, but we surface a toast so the
// user knows their annotations aren't appearing on this read.
export function useAiComments(libraryItemId: string): UseAiCommentsResult {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const t = useTranslations("reader.aiComments");
  const [comments, setComments] = useState<AiCommentRecord[]>([]);
  // Tick increments to force a refetch. Bumping a counter is simpler than
  // exposing a fetch function whose identity changes — callers can stay stable.
  const [refetchTick, setRefetchTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const notifyLoadFailure = () => {
      if (controller.signal.aborted) {
        return;
      }
      emitReaderToast({
        message: t("highlightsLoadFailed"),
        tone: "warning",
      });
    };

    const run = async () => {
      const token = await getToken();
      if (!token) {
        return;
      }
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
          libraryItemId,
        )}/ai-comments`,
        {
          method: "GET",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) {
        notifyLoadFailure();
        return;
      }
      const data = (await response.json()) as { items?: AiCommentRecord[] };
      if (!controller.signal.aborted) {
        setComments(data.items ?? []);
      }
    };

    run().catch(() => {
      notifyLoadFailure();
    });

    return () => {
      controller.abort();
    };
  }, [getToken, isLoaded, isSignedIn, libraryItemId, refetchTick, t]);

  const refetch = useCallback(() => {
    setRefetchTick((tick) => tick + 1);
  }, []);

  return { comments, refetch };
}
