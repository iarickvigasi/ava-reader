import { segmentSentences } from "./sentence-segments";

export function selectionSentenceContext(
  input: Parameters<typeof selectionSentenceWindow>[0],
): string {
  return selectionSentenceWindow(input).context;
}

// DOM offsets may differ after whitespace collapse. Locate the actual fragment first.
export function selectionSentenceWindow(input: {
  text: string;
  selectedText: string;
  start: number;
  end: number;
  maxChars: number;
}) {
  const { text, maxChars } = input;
  const range = reanchor(text, input.selectedText, input.start, input.end);
  const sentences = segmentSentences(text);
  const containing = sentences?.filter(
    (sentence) => sentence.end > range.start && sentence.start < range.end,
  );
  const start = containing?.[0]?.start ?? 0;
  const end = containing?.at(-1)?.end ?? text.length;
  const from =
    end - start <= maxChars
      ? start
      : Math.max(
          start,
          range.start -
            Math.floor(
              (maxChars - Math.min(maxChars, range.end - range.start)) / 2,
            ),
        );
  const raw = text.slice(from, Math.min(end, from + maxChars));
  const context = raw.trim();
  const contextOffset =
    range.start - from - (raw.length - raw.trimStart().length);
  return {
    context,
    contextOffset:
      contextOffset >= 0 &&
      context.slice(
        contextOffset,
        contextOffset + input.selectedText.trim().length,
      ) === input.selectedText.trim()
        ? contextOffset
        : undefined,
  };
}

function reanchor(text: string, selected: string, start: number, end: number) {
  const escaped = selected
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  let closest: { start: number; end: number } | undefined;
  if (escaped) {
    for (const match of text.matchAll(new RegExp(escaped, "gu"))) {
      if (
        !closest ||
        Math.abs(match.index - start) < Math.abs(closest.start - start)
      ) {
        closest = { start: match.index, end: match.index + match[0].length };
      }
    }
  }
  return (
    closest ?? {
      start: Math.max(0, Math.min(start, text.length - 1)),
      end: Math.min(text.length, Math.max(start + 1, end)),
    }
  );
}
