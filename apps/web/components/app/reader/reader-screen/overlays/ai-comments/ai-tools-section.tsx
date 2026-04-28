import { useEffect, useState } from "react";
import {
  ReaderTranslationIcon,
  SparkIcon,
  SpeakerIcon,
} from "@/components/app/shared/app-icons";
import { EtymologyIcon, LightbulbIcon } from "./ai-comments-icons";
import { ToolResultView } from "./tool-result-view";
import { ToolSection } from "./tool-section";
import { useAiTool } from "./use-ai-tool";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "./translate-target-lang";

type ToolKey = "translate" | "etymology" | "explain";

type AiToolsSectionProps = {
  libraryItemId: string;
  selectedText: string;
};

export function AiToolsSection({
  libraryItemId,
  selectedText,
}: AiToolsSectionProps) {
  // Multi-open accordion: each tool has its own open/closed state and opening
  // one does NOT collapse the others. Sections only close when the user
  // clicks them again or when the whole panel is dismissed (the component
  // unmounts then, so this state resets naturally on next open).
  const [openTools, setOpenTools] = useState<ReadonlySet<ToolKey>>(
    () => new Set(),
  );
  const [targetLang] = useTranslateTargetLang();

  const translate = useAiTool({ libraryItemId });
  const etymology = useAiTool({ libraryItemId });
  const explain = useAiTool({ libraryItemId });

  const trimmedSelection = selectedText.trim();

  const isTranslateOpen = openTools.has("translate");
  const isEtymologyOpen = openTools.has("etymology");
  const isExplainOpen = openTools.has("explain");

  // One trigger effect per tool. Each fires when its section is open AND
  // there's a selection — opening multiple tools simultaneously kicks off
  // their requests in parallel, and changing the selection refreshes all
  // currently-open tools at once.
  useEffect(() => {
    if (!isTranslateOpen || !trimmedSelection) {
      return;
    }
    translate.start({
      kind: "translate",
      text: trimmedSelection,
      targetLang: targetLang || DEFAULT_TRANSLATE_TARGET_LANG,
    });
    // `translate` is stable across renders; depending on it would re-fire on
    // every render and we'd never settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTranslateOpen, trimmedSelection, targetLang]);

  useEffect(() => {
    if (!isEtymologyOpen || !trimmedSelection) {
      return;
    }
    etymology.start({
      kind: "etymology",
      text: trimmedSelection,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEtymologyOpen, trimmedSelection]);

  useEffect(() => {
    if (!isExplainOpen || !trimmedSelection) {
      return;
    }
    explain.start({
      kind: "explain",
      text: trimmedSelection,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExplainOpen, trimmedSelection]);

  // When a panel selection clears (user closed the panel and reopened), drop
  // any leftover bodies so the empty hint shows again.
  useEffect(() => {
    if (trimmedSelection.length === 0) {
      translate.reset();
      etymology.reset();
      explain.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedSelection]);

  const toggle = (tool: ToolKey) => {
    setOpenTools((current) => {
      const next = new Set(current);
      if (next.has(tool)) {
        next.delete(tool);
      } else {
        next.add(tool);
      }
      return next;
    });
  };

  const emptyHint = trimmedSelection
    ? "Generating\u2026"
    : "Select text in the reader to see this here.";

  return (
    <div className="flex flex-col gap-4">
      <ToolSection
        icon={<ReaderTranslationIcon className="size-4" />}
        label="Translate"
        isExpanded={isTranslateOpen}
        onToggle={() => toggle("translate")}
      >
        <TranslateBody
          languageLabel={targetLang || DEFAULT_TRANSLATE_TARGET_LANG}
          text={translate.text}
          isStreaming={translate.isStreaming}
          error={translate.error}
          emptyHint={emptyHint}
          onRetry={
            trimmedSelection
              ? () =>
                  translate.start({
                    kind: "translate",
                    text: trimmedSelection,
                    targetLang: targetLang || DEFAULT_TRANSLATE_TARGET_LANG,
                  })
              : undefined
          }
        />
      </ToolSection>

      <ToolSection
        icon={<EtymologyIcon className="size-4" />}
        label="Etymology"
        isExpanded={isEtymologyOpen}
        onToggle={() => toggle("etymology")}
      >
        <ToolResultView
          text={etymology.text}
          isStreaming={etymology.isStreaming}
          error={etymology.error}
          emptyHint={emptyHint}
          onRetry={
            trimmedSelection
              ? () =>
                  etymology.start({
                    kind: "etymology",
                    text: trimmedSelection,
                  })
              : undefined
          }
        />
      </ToolSection>

      <ToolSection
        icon={<LightbulbIcon className="size-4" />}
        label="Explain"
        isExpanded={isExplainOpen}
        onToggle={() => toggle("explain")}
      >
        <ToolResultView
          text={explain.text}
          isStreaming={explain.isStreaming}
          error={explain.error}
          emptyHint={emptyHint}
          onRetry={
            trimmedSelection
              ? () =>
                  explain.start({
                    kind: "explain",
                    text: trimmedSelection,
                  })
              : undefined
          }
        />
      </ToolSection>

      <ToolSection
        variant="link"
        icon={<SparkIcon className="size-4" />}
        label="Ask AI"
      />
    </div>
  );
}

function TranslateBody({
  languageLabel,
  text,
  isStreaming,
  error,
  emptyHint,
  onRetry,
}: {
  languageLabel: string;
  text: string;
  isStreaming: boolean;
  error: string | null;
  emptyHint: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.14em] text-ink/70">
        {languageLabel}
      </p>
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Read translation aloud"
          className="mt-[2px] inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink/70 transition hover:bg-paper-strong/70 hover:text-ink"
        >
          <SpeakerIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <ToolResultView
            text={text}
            isStreaming={isStreaming}
            error={error}
            emptyHint={emptyHint}
            onRetry={onRetry}
          />
        </div>
      </div>
    </div>
  );
}
