import { TranslateTargetField } from "@/components/app/preferences/translate-target-field";
import { useMemo } from "react";
import { languageCode } from "./translation-language";
import {
  ReaderTranslationIcon,
  SpeakerIcon,
} from "@/components/app/shared/app-icons";
import type { SavedComment } from "./saved-comments";
import { ToolResultView } from "./tool-result-view";
import { ToolSection } from "./tool-section";
import type { AiToolPayload } from "../generate/ai-tool-payload";
import { useAiToolBinding } from "./use-ai-tool-binding";

type TranslateToolItemProps = {
  label: string;
  language: string;
  sourceLanguage?: string | null;
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
  sourceLanguage,
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
  const sameLanguage =
    !!sourceLanguage && languageCode(sourceLanguage) === languageCode(language);
  const payload = useMemo<AiToolPayload | null>(
    () =>
      selection && language && !sameLanguage
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
    [selection, language, locator, context, bookTitle, author, sameLanguage],
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
              text={sameLanguage ? selection : text}
              isStreaming={isStreaming}
              error={error}
              phase={phase}
              failureReason={failureReason}
              onRetry={retry}
            />
          </div>
        </div>
      </ToolSection>
    </div>
  );
}
