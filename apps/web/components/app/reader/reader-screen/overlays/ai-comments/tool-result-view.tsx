import { cn } from "@/lib/cn";

type ToolResultViewProps = {
  // Either a hint shown when there's no selection yet, or the actual streamed
  // body. The component decides which to render based on `text`.
  text: string;
  isStreaming: boolean;
  error: string | null;
  // Shown when no generation has been kicked off yet (no selection, panel
  // just opened, etc.).
  emptyHint: string;
  onRetry?: () => void;
};

// Shared body for the three AI Comments accordion sections. Handles the
// empty / streaming / error / done states so the per-tool wrappers only need
// to pass props.
export function ToolResultView({
  text,
  isStreaming,
  error,
  emptyHint,
  onRetry,
}: ToolResultViewProps) {
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-(--font-display) text-[0.95rem] leading-[1.5] text-ink/80">
          {error}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex w-fit items-center rounded-full bg-paper-strong/70 px-3 py-1.5 font-(--font-ui) text-[0.7rem] uppercase tracking-[0.16em] text-ink transition hover:bg-paper-strong"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (text.length === 0 && !isStreaming) {
    return (
      <p className="font-(--font-display) text-[0.95rem] leading-[1.5] text-ink/55">
        {emptyHint}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "font-(--font-display) text-[1.05rem] leading-[1.4] text-ink",
        isStreaming && "after:ml-1 after:inline-block after:h-[1em] after:w-[2px] after:translate-y-[2px] after:animate-pulse after:bg-ink/60 after:align-middle",
      )}
    >
      {text || (isStreaming ? "\u2026" : "")}
    </p>
  );
}
