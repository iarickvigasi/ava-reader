import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { ToolRetryButton } from "./tool-retry-button";

export type ToolPhase = "queued" | "failed" | null;

type ToolResultViewProps = {
  text: string;
  isStreaming: boolean;
  error: string | null;
  phase?: ToolPhase;
  failureReason?: string | null;
  onRetry?: () => void;
};

export function ToolResultView({
  text,
  isStreaming,
  error,
  phase = null,
  failureReason = null,
  onRetry,
}: ToolResultViewProps) {
  const t = useTranslations("reader.aiTools");

  const failureMessage =
    error ?? (phase === "failed" ? failureReason || t("errors.generic") : null);
  if (failureMessage) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-[0.95rem] leading-normal text-ink/80">
          {failureMessage}
        </p>
        {onRetry ? (
          <ToolRetryButton onClick={onRetry} label={t("tryAgain")} />
        ) : null}
      </div>
    );
  }

  if (phase === "queued" && text.length === 0) {
    return (
      <p className="font-display text-[1.05rem] leading-[1.4] text-ink/55">
        {t("queued")}
      </p>
    );
  }

  const isWaiting = isStreaming && text.length === 0;

  return (
    <div className="flex flex-col gap-3">
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
      {!isStreaming && !phase && text && onRetry ? (
        <ToolRetryButton onClick={onRetry} label={t("regenerate")} />
      ) : null}
    </div>
  );
}
