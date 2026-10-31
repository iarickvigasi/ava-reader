import type { NarrationInput } from "./selection-narration-input";
import { getPublicApiBaseUrl } from "@/lib/api";

// Ephemeral media: no saved user data or mutation is sent outside a bucket.
export async function requestNarration(
  input: NarrationInput & {
    libraryItemId: string;
    getToken: () => Promise<string | null>;
    signal: AbortSignal;
  },
) {
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(60_000)]);
  const token = await new Promise<string | null>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    input
      .getToken()
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener("abort", abort);
      });
  });
  signal.throwIfAborted();
  if (!token) {
    const error = new Error("Authentication unavailable");
    error.name = "NarrationAuthError";
    throw error;
  }
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(input.libraryItemId)}/narration`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        context: input.context,
        contextOffset: input.contextOffset,
        languageHint: input.languageHint,
        translationLanguage: input.translationLanguage,
      }),
      signal,
    },
  );
  if (response.status === 401) {
    const error = new Error("Authentication unavailable");
    error.name = "NarrationAuthError";
    throw error;
  }
  if (response.status === 503) {
    const detail: unknown = await response.json().catch(() => null);
    const error = new Error("Narration service unavailable");
    error.name =
      detail &&
      typeof detail === "object" &&
      "code" in detail &&
      detail.code === "NARRATION_TIMEOUT"
        ? "TimeoutError"
        : "NarrationProviderError";
    throw error;
  }
  if (response.status === 422) {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "code" in body &&
      body.code === "NARRATION_LANGUAGE_UNCERTAIN"
    ) {
      const error = new Error("Language is uncertain");
      error.name = "NarrationLanguageUncertainError";
      throw error;
    }
  }
  if (!response.ok) throw new Error("Narration unavailable");
  const audio = await response.blob();
  if (!audio.size || !audio.type.startsWith("audio/"))
    throw new Error("Invalid audio");
  return audio;
}
