import { useMemo } from "react";
import {
  ReaderTranslationIcon,
  SpeakerIcon,
} from "@/components/app/shared/app-icons";
import { ToolResultView } from "./tool-result-view";
import { ToolSection } from "./tool-section";
import type { AiToolPayload } from "./use-ai-tool";
import { useAiToolBinding } from "./use-ai-tool-binding";

type TranslateToolItemProps = {
  label: string;
  language: string;
  isOpen: boolean;
  onToggle: () => void;
  libraryItemId: string;
  selection: string;
  locator: string | undefined;
  emptyHint: string;
};

export function TranslateToolItem({
  label,
  language,
  isOpen,
  onToggle,
  libraryItemId,
  selection,
  locator,
  emptyHint,
}: TranslateToolItemProps) {
  const payload = useMemo<AiToolPayload | null>(
    () =>
      selection
        ? {
            kind: "translate",
            text: selection,
            targetLang: language,
            locator,
          }
        : null,
    [selection, language, locator],
  );
  const { text, isStreaming, error, retry } = useAiToolBinding({
    libraryItemId,
    isOpen,
    selection,
    payload,
  });

  return (
    <ToolSection
      icon={<ReaderTranslationIcon className="size-4" />}
      label={label}
      isExpanded={isOpen}
      onToggle={onToggle}
    >
      <div className="flex flex-col gap-2">
        <p className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.14em] text-ink/70">
          {language}
        </p>
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label="Read translation aloud"
            className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-paper-strong/70 hover:text-ink"
          >
            <SpeakerIcon className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <ToolResultView
              text={text}
              isStreaming={isStreaming}
              error={error}
              emptyHint={emptyHint}
              onRetry={retry}
            />
          </div>
        </div>
      </div>
    </ToolSection>
  );
}
