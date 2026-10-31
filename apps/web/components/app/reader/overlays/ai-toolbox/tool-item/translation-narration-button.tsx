import type { TranslationNarrationSource } from "@/features/narration/translation-narration-input";
import { useTranslations } from "next-intl";
import { useTextNarration } from "@/features/narration/use-text-narration";
import { NarrationControl } from "../sections/narration-control";
import { translationNarrationInput } from "@/features/narration/translation-narration-input";

export function TranslationNarrationButton({
  libraryItemId,
  text,
  language,
  scope,
  source,
}: {
  libraryItemId: string;
  text: string;
  language: string;
  scope: string;
  source?: TranslationNarrationSource;
}) {
  const t = useTranslations("reader.aiToolbox");
  const narration = useTextNarration({
    libraryItemId,
    scope,
    input: translationNarrationInput({ text, language, source }),
  });
  return (
    <NarrationControl
      {...narration}
      idleLabel={t("translationReadAloud")}
      feedbackClassName="col-span-2 row-start-2"
    />
  );
}
