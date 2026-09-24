import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { AiToolPayload } from "./ai-tool-payload";

type State = {
  text: string;
  isStreaming: boolean;
  error: string | null;
};

const INITIAL_STATE: State = { text: "", isStreaming: false, error: null };

type UseAiToolInput = {
  libraryItemId: string;
};

type UseAiToolResult = {
  text: string;
  isStreaming: boolean;
  error: string | null;
  // Kicks off a generation. Aborts any in-flight request first so a stale
  // response can't overwrite a newer one.
  start: (payload: AiToolPayload) => void;
  // Cancels the in-flight generation without resetting the displayed body.
  abort: () => void;
  // Clears displayed text + error. Called when the panel closes or the
  // selection changes so the next open starts from a blank state.
  reset: () => void;
};

// Hits a streaming AI Comments endpoint and surfaces the body as it arrives.
// Returns plain text from the API (the server uses `pipeTextStreamToResponse`
// from the Vercel AI SDK), so we just decode the response body chunk by chunk.
//
// Each call to start() supersedes the previous one — we abort the in-flight
// request before opening a new one so two rapid selections don't race to
// overwrite each other.
export function useAiTool({ libraryItemId }: UseAiToolInput): UseAiToolResult {
  const t = useTranslations("reader.aiTools.errors");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [state, setState] = useState<State>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    setState(INITIAL_STATE);
  }, [abort]);

  const start = useCallback(
    (payload: AiToolPayload) => {
      // Abort the previous in-flight stream and start fresh.
      abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ text: "", isStreaming: true, error: null });

      const run = async () => {
        if (!isLoaded || !isSignedIn) {
          throw new Error(t("signIn"));
        }
        const token = await getToken();
        if (!token) {
          throw new Error(t("noToken"));
        }

        const response = await postToolRequest(
          libraryItemId,
          payload,
          token,
          controller.signal,
        );
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            detail || t("requestFailed", { status: response.status }),
          );
        }
        if (!response.body) {
          throw new Error(t("emptyStream"));
        }

        const text = await readTextStream(
          response.body,
          controller.signal,
          (accumulated) =>
            setState({ text: accumulated, isStreaming: true, error: null }),
        );
        // null means a newer call aborted us mid-stream — its own state wins.
        if (text !== null) {
          setState({ text, isStreaming: false, error: null });
        }
      };

      run().catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : t("generic");
        setState((current) => ({
          ...current,
          isStreaming: false,
          error: message,
        }));
      });
    },
    [abort, getToken, isLoaded, isSignedIn, libraryItemId, t],
  );

  // On unmount, make sure no fetch outlives the component.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    text: state.text,
    isStreaming: state.isStreaming,
    error: state.error,
    start,
    abort,
    reset,
  };
}

// POSTs the whole payload to the tool's streaming endpoint — the server's
// Zod schemas strip the extra `kind` discriminator silently.
function postToolRequest(
  libraryItemId: string,
  payload: AiToolPayload,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  const url = `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
    libraryItemId,
  )}/ai-comments/${payload.kind}`;
  return fetch(url, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/plain",
    },
    body: JSON.stringify(payload),
  });
}

// Reads the response stream to completion, reporting the accumulated text
// after every chunk — the panel re-renders on each call, giving the
// typewriter effect. Returns the full text, or null when `signal` aborted
// between reads (the aborting caller owns the state from then on).
async function readTextStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onProgress: (accumulated: string) => void,
): Promise<string | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // Flush any trailing bytes left in the decoder.
      accumulated += decoder.decode();
      return signal.aborted ? null : accumulated;
    }
    accumulated += decoder.decode(value, { stream: true });
    if (signal.aborted) {
      return null;
    }
    onProgress(accumulated);
  }
}
