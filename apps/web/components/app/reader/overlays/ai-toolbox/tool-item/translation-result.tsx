import type { TranslationNarrationSource } from "@/features/narration/translation-narration-input";
import type { ComponentProps } from "react";
import { TranslationNarrationButton } from "./translation-narration-button";
import { ToolResultView } from "./tool-result-view";

export function TranslationResult({
  libraryItemId,
  language,
  scope,
  source,
  ...view
}: ComponentProps<typeof ToolResultView> & {
  libraryItemId: string;
  language: string;
  scope: string;
  source?: TranslationNarrationSource;
}) {
  const speakableText =
    !view.isStreaming && !view.phase && !view.error ? view.text : "";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2">
      <TranslationNarrationButton
        libraryItemId={libraryItemId}
        text={speakableText}
        language={language}
        scope={scope}
        source={source}
      />
      <div className="col-start-2 row-start-1 min-w-0">
        <ToolResultView {...view} />
      </div>
    </div>
  );
}
