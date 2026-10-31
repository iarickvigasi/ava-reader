import { narrationFeedbackKey } from "@/features/narration/narration-error-state";
import type { ReaderBookPayload, ReaderChapterPayload } from "@/lib/api-types";
import { useTranslations } from "next-intl";
import { SpeakerIcon } from "@/components/app/shared/app-icons";
import { useSelectionNarration } from "./use-selection-narration";

export function NarrationButton({
  libraryItemId,
  book,
  chapters,
}: {
  libraryItemId: string;
  book: ReaderBookPayload;
  chapters: ReaderChapterPayload[];
}) {
  const t = useTranslations("reader.aiToolbox");
  const { state, toggle, disabled } = useSelectionNarration(
    libraryItemId,
    book,
    chapters,
  );
  const feedback = narrationFeedbackKey(state);
  const active = state === "loading" || state === "playing";
  const label =
    state === "loading"
      ? t("narrationLoading")
      : state === "playing"
        ? t("narrationStop")
        : state === "ready"
          ? t("narrationReady")
          : t("selectionReadAloud");
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={toggle}
        disabled={disabled}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-paper-strong/70 hover:text-ink disabled:opacity-40"
      >
        {state === "loading" ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : state === "playing" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 9v6m4-10v14m4-11v8m4-13v18m4-12v6" />
          </svg>
        ) : (
          <SpeakerIcon aria-hidden="true" className="size-4" />
        )}
      </button>
      <span
        role={feedback && state !== "ready" ? "alert" : "status"}
        className={feedback ? "text-xs text-ink/70" : "sr-only"}
      >
        {feedback ? t(feedback) : active ? label : ""}
      </span>
    </>
  );
}
