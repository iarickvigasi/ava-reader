import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicApiBaseUrl } from "@/lib/api";

// The three tools mounted in the AI Comments panel. Mirrors the
// AiCommentKind enum in the API.
export type AiToolKind = "translate" | "etymology" | "explain";

// Payload shape per tool. `text` is always required; the rest depend on the
// tool. Validation lives on the server.
export type AiToolPayload =
  | { kind: "translate"; text: string; targetLang: string; locator?: string }
  | { kind: "etymology"; text: string; locator?: string }
  | {
      kind: "explain";
      text: string;
      context?: string;
      bookTitle?: string;
      author?: string;
      locator?: string;
    };

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

        const url = `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
          libraryItemId,
        )}/ai-comments/${payload.kind}`;

        // Send the whole payload — the server's Zod schemas strip the
        // extra `kind` discriminator silently.
        const response = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "text/plain",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            detail || t("requestFailed", { status: response.status }),
          );
        }

        if (!response.body) {
          throw new Error(t("emptyStream"));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        // Read until the server closes the stream. Each iteration we decode
        // the incoming bytes and append to the running text — the panel
        // re-renders on every chunk, giving the typewriter effect.
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush any trailing bytes left in the decoder.
            accumulated += decoder.decode();
            break;
          }
          accumulated += decoder.decode(value, { stream: true });
          // Bail out early if a newer call has aborted us between reads.
          if (controller.signal.aborted) {
            return;
          }
          setState({
            text: accumulated,
            isStreaming: true,
            error: null,
          });
        }

        if (!controller.signal.aborted) {
          setState({
            text: accumulated,
            isStreaming: false,
            error: null,
          });
        }
      };

      run().catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : t("generic");
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
