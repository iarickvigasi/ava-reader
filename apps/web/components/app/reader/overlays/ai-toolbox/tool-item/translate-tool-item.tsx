import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { TRANSLATE_LANGUAGES } from "@/components/app/preferences/translate-languages";
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
  const t = useTranslations("reader.aiTools");
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
    <ToolSection
      icon={<ReaderTranslationIcon className="size-4" />}
      label={label}
      isExpanded={isOpen}
      onToggle={onToggle}
    >
      <div className="flex flex-col gap-2">
        {onLanguageChange ? (
          <select
            aria-label={t("targetLanguage")}
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="rounded-control border border-ink/15 bg-paper p-2 text-sm text-ink"
          >
            <option value="">{t("chooseLanguage")}</option>
            {language &&
              !TRANSLATE_LANGUAGES.some(
                (option) => option.value === language,
              ) && <option value={language}>{language}</option>}
            {TRANSLATE_LANGUAGES.filter(
              (option) =>
                !sourceLanguage ||
                languageCode(option.value) !== languageCode(sourceLanguage),
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="font-ui text-[0.78rem] uppercase tracking-[0.14em] text-ink/70">
            {language}
          </p>
        )}
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
              phase={phase}
              failureReason={failureReason}
              onRetry={retry}
            />
          </div>
        </div>
      </div>
    </ToolSection>
  );
}
