import type { SearchMatch } from "./types";

export function findMatches(text: string, query: string): SearchMatch[] {
  const words = query.trim().split(/\s+/u);
  if (!words[0]) return [];
  const pattern = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const wholeWord =
    words.length === 1 && /^[\p{L}\p{N}\p{M}_]+$/u.test(words[0]);
  const expression = new RegExp(
    wholeWord
      ? `(?<![\\p{L}\\p{N}\\p{M}_])${pattern}(?![\\p{L}\\p{N}\\p{M}_])`
      : pattern,
    "giu",
  );
  return Array.from(text.matchAll(expression), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}
