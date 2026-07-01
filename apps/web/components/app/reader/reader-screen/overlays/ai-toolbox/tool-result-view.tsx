import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

// Offline-derived view state, layered on top of the live streaming state:
//   "queued"  — request is waiting for a connection (placeholder shown)
//   "failed"  — a permanent server rejection (reason shown inline + retry)
//   null      — neither; render the live streaming / saved body
export type ToolPhase = "queued" | "failed" | null;

type ToolResultViewProps = {
  text: string;
  isStreaming: boolean;
  error: string | null;
  phase?: ToolPhase;
  // Reason for a permanently-failed offline replay (shown when phase is
  // "failed"); replaces the old drop toast.
  failureReason?: string | null;
  onRetry?: () => void;
};

// Shared body for the three AI Comments accordion library-sections. Handles
// the queued / streaming / failed / done states so the per-tool wrappers only
// need to pass props.
export function ToolResultView({
  text,
  isStreaming,
  error,
  phase = null,
  failureReason = null,
  onRetry,
}: ToolResultViewProps) {
  const t = useTranslations("reader.aiTools");

  // A live request error, or a permanently-failed offline replay — both render
  // the same "couldn't complete" layout with a retry. The failed comment's
  // stored reason stands in for the (now removed) drop toast.
  const failureMessage =
    error ?? (phase === "failed" ? failureReason || t("errors.generic") : null);
  if (failureMessage) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-[0.95rem] leading-normal text-ink/80">
          {failureMessage}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex w-fit items-center rounded-full bg-paper-strong/70 px-3 py-1.5 font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink transition hover:bg-paper-strong"
          >
            {t("tryAgain")}
          </button>
        ) : null}
      </div>
    );
  }

  // Queued offline: nothing is streaming and there's no body yet. Show a calm
  // placeholder; the streamed body replaces it automatically once the queued
  // request replays on reconnect (the selector-merged body wins below).
  if (phase === "queued" && text.length === 0) {
    return (
      <p className="font-display text-[1.05rem] leading-[1.4] text-ink/55">
        {t("queued")}
      </p>
    );
  }

  // Cross-fade between the "Generating…" placeholder and the streamed body in
  // the same grid cell. Both children share `col-start-1 row-start-1` so the
  // taller of the two sizes the box — the placeholder is ~1 line, the body
  // grows as chunks arrive — and opacity transitions blend them. The streamed
  // body owns the blinking caret while still streaming.
  const isWaiting = isStreaming && text.length === 0;

  return (
    <div className="grid">
      <p
        aria-hidden={!isWaiting}
        className={cn(
          "col-start-1 row-start-1 font-display text-[1.05rem] leading-[1.4] text-ink/55 transition-opacity duration-300",
          isWaiting ? "animate-pulse opacity-100" : "opacity-0",
        )}
      >
        {t("generating")}
      </p>
      <p
        className={cn(
          "col-start-1 row-start-1 font-display text-[1.05rem] leading-[1.4] text-ink transition-opacity duration-300",
          text.length === 0 ? "opacity-0" : "opacity-100",
          isStreaming &&
            text.length > 0 &&
            "after:ml-1 after:inline-block after:h-[1em] after:w-0.5 after:translate-y-0.5 after:animate-pulse after:bg-ink/60 after:align-middle",
        )}
      >
        {text}
      </p>
    </div>
  );
}
