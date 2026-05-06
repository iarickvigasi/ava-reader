import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "@/components/app/preferences/use-translate-target-lang";
import {
  ReaderTranslationIcon,
  SparkIcon,
  SpeakerIcon,
} from "@/components/app/shared/app-icons";
import { useReaderSelectionContext } from "../../screen/reader-selection-context";
import { useAiCommentsContext } from "./ai-comments-context";
import { EtymologyIcon, LightbulbIcon } from "./ai-comments-icons";
import { ToolResultView } from "./tool-result-view";
import { ToolSection } from "./tool-section";
import { useAiTool } from "./use-ai-tool";

type ToolKey = "translate" | "etymology" | "explain";

type AiToolsSectionProps = {
  libraryItemId: string;
};

export function AiToolsSection({ libraryItemId }: AiToolsSectionProps) {
  const t = useTranslations("reader.aiTools");
  const { text: selectedText, locator: selectedLocator } =
    useReaderSelectionContext();
  const { refetch: refetchAiComments } = useAiCommentsContext();
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

  const trimmedSelection = (selectedText ?? "").trim();
  // Serialise once per selection. The server stores this string verbatim in
  // AiComment.locator so it can re-anchor the highlight on a future read.
  const locatorJson = useMemo(
    () => (selectedLocator ? JSON.stringify(selectedLocator) : undefined),
    [selectedLocator],
  );

  const isTranslateOpen = openTools.has("translate");
  const isEtymologyOpen = openTools.has("etymology");
  const isExplainOpen = openTools.has("explain");

  // Tracks the previous streaming flag for each tool so we can fire
  // onCommentCreated exactly once when a stream transitions from
  // streaming → done with a non-empty body. The server persists the comment
  // inside the stream's onFinish callback, so by the time isStreaming flips
  // to false the row is already in the DB and a refetch will see it.
  const prevStreaming = useRef({
    translate: false,
    etymology: false,
    explain: false,
  });
  useEffect(() => {
    const cur = {
      translate: translate.isStreaming,
      etymology: etymology.isStreaming,
      explain: explain.isStreaming,
    };
    const finishedTranslate =
      prevStreaming.current.translate && !cur.translate && translate.text;
    const finishedEtymology =
      prevStreaming.current.etymology && !cur.etymology && etymology.text;
    const finishedExplain =
      prevStreaming.current.explain && !cur.explain && explain.text;
    if (finishedTranslate || finishedEtymology || finishedExplain) {
      refetchAiComments();
    }
    prevStreaming.current = cur;
  }, [
    translate.isStreaming,
    translate.text,
    etymology.isStreaming,
    etymology.text,
    explain.isStreaming,
    explain.text,
    refetchAiComments,
  ]);

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
      locator: locatorJson,
    });
    // `translate` is stable across renders; depending on it would re-fire on
    // every render and we'd never settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTranslateOpen, trimmedSelection, targetLang, locatorJson]);

  useEffect(() => {
    if (!isEtymologyOpen || !trimmedSelection) {
      return;
    }
    etymology.start({
      kind: "etymology",
      text: trimmedSelection,
      locator: locatorJson,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEtymologyOpen, trimmedSelection, locatorJson]);

  useEffect(() => {
    if (!isExplainOpen || !trimmedSelection) {
      return;
    }
    explain.start({
      kind: "explain",
      text: trimmedSelection,
      locator: locatorJson,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExplainOpen, trimmedSelection, locatorJson]);

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
    ? t("generating")
    : t("selectTextHint");

  return (
    <div className="flex flex-col gap-4">
      <ToolSection
        icon={<ReaderTranslationIcon className="size-4" />}
        label={t("translate")}
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
                    locator: locatorJson,
                  })
              : undefined
          }
        />
      </ToolSection>

      <ToolSection
        icon={<EtymologyIcon className="size-4" />}
        label={t("etymology")}
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
                    locator: locatorJson,
                  })
              : undefined
          }
        />
      </ToolSection>

      <ToolSection
        icon={<LightbulbIcon className="size-4" />}
        label={t("explain")}
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
                    locator: locatorJson,
                  })
              : undefined
          }
        />
      </ToolSection>

      <ToolSection
        variant="link"
        icon={<SparkIcon className="size-4" />}
        label={t("askAi")}
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
            onRetry={onRetry}
          />
        </div>
      </div>
    </div>
  );
}
