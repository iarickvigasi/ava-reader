import type { NarrationState } from "./selection-player";
export function narrationErrorState(error: unknown): NarrationState {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") return "ready";
  if (name === "NarrationLanguageUncertainError") return "uncertain";
  if (name === "NarrationAuthError") return "auth";
  if (name === "NarrationProviderError") return "provider";
  if (name === "TimeoutError") return "timeout";
  return "error";
}
export function narrationFeedbackKey(state: NarrationState) {
  if (state === "ready") return "narrationReady";
  if (state === "auth") return "narrationAuth";
  if (state === "provider") return "narrationProvider";
  if (state === "timeout") return "narrationTimeout";
  if (state === "uncertain") return "narrationLanguageUncertain";
  if (state === "error") return "narrationFailed";
  return null;
}
