import { segmentSentences } from "./sentence-segments";

// DOM offsets may differ after whitespace collapse. Locate the actual fragment first.
export function selectionSentenceContext(input: {
  text: string;
  selectedText: string;
  start: number;
  end: number;
  maxChars: number;
}): string {
  const { text, maxChars } = input;
  const range = reanchor(text, input.selectedText, input.start, input.end);
  const sentences = segmentSentences(text);
  const containing = sentences?.filter(
    (sentence) => sentence.end > range.start && sentence.start < range.end,
  );
  const start = containing?.[0]?.start ?? 0;
  const end = containing?.at(-1)?.end ?? text.length;
  if (end - start <= maxChars) return text.slice(start, end).trim();
  const from = Math.max(
    start,
    range.start -
      Math.floor((maxChars - Math.min(maxChars, range.end - range.start)) / 2),
  );
  return text.slice(from, Math.min(end, from + maxChars)).trim();
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
