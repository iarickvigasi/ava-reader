import { TranslateTargetField } from "@/components/app/preferences/translate-target-field";
import { useMemo } from "react";
import { ReaderTranslationIcon } from "@/components/app/shared/app-icons";
import { TranslationResult } from "./translation-result";
import type { SavedComment } from "./saved-comments";
import { ToolSection } from "./tool-section";
import type { AiToolPayload } from "../generate/ai-tool-payload";
import { useAiToolBinding } from "./use-ai-tool-binding";

type TranslateToolItemProps = {
  label: string;
  language: string;
  onLanguageChange?: (language: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  libraryItemId: string;
  selection: string;
  locator: string | undefined;
  context: string | undefined;
  bookTitle: string | undefined;
  author: string | undefined;
  saved?: SavedComment;
};

export function TranslateToolItem({
  label,
  language,
  onLanguageChange,
  isOpen,
  onToggle,
  libraryItemId,
  selection,
  locator,
  context,
  bookTitle,
  author,
  saved,
}: TranslateToolItemProps) {
  const payload = useMemo<AiToolPayload | null>(
    () =>
      selection && language
        ? {
            kind: "translate",
            text: selection,
            targetLang: language,
            locator,
            context,
            bookTitle,
            author,
          }
        : null,
    [selection, language, locator, context, bookTitle, author],
  );
  const { text, isStreaming, error, phase, failureReason, retry } =
    useAiToolBinding({
      libraryItemId,
      isOpen,
      selection,
      payload,
      saved,
    });

  return (
    <div className="flex flex-col gap-2">
      {onLanguageChange ? (
        <TranslateTargetField value={language} onChange={onLanguageChange} />
      ) : (
        <p className="font-ui text-[0.78rem] uppercase tracking-[0.14em] text-ink/70">
          {language}
        </p>
      )}
      <ToolSection
        icon={<ReaderTranslationIcon className="size-4" />}
        label={label}
        isExpanded={isOpen}
        onToggle={onToggle}
      >
        <TranslationResult
          libraryItemId={libraryItemId}
          language={language}
          scope={`${locator}:${language}`}
          source={{ text: selection, context, bookTitle, author }}
          text={text}
          isStreaming={isStreaming}
          error={error}
          phase={phase}
          failureReason={failureReason}
          onRetry={retry}
        />
      </ToolSection>
    </div>
  );
}
