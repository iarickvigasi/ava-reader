import { type ReactNode, useMemo } from "react";
import { ToolResultView } from "./tool-result-view";
import { ToolSection } from "./tool-section";
import type { AiToolPayload } from "./use-ai-tool";
import { useAiToolBinding } from "./use-ai-tool-binding";

// The simple-shape tools (etymology, explain) — single-string payload, plain
// streamed body. Translate has its own component because of the language
// header and speaker button.
type SimpleToolKind = Extract<AiToolPayload, { kind: "etymology" | "explain" }>["kind"];

type AiToolItemProps = {
  kind: SimpleToolKind;
  icon: ReactNode;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  libraryItemId: string;
  selection: string;
  locator: string | undefined;
  savedText?: string;
};

export function AiToolItem({
  kind,
  icon,
  label,
  isOpen,
  onToggle,
  libraryItemId,
  selection,
  locator,
  savedText,
}: AiToolItemProps) {
  const payload = useMemo<AiToolPayload | null>(
    () => (selection ? { kind, text: selection, locator } : null),
    [kind, selection, locator],
  );
  const { text, isStreaming, error, retry } = useAiToolBinding({
    libraryItemId,
    isOpen,
    selection,
    payload,
    savedText,
  });

  return (
    <ToolSection
      icon={icon}
      label={label}
      isExpanded={isOpen}
      onToggle={onToggle}
    >
      <ToolResultView
        text={text}
        isStreaming={isStreaming}
        error={error}
        onRetry={retry}
      />
    </ToolSection>
  );
}
