import type {
  BilingualChapter,
  SentenceAlignment,
} from "@/lib/api-types/bilingual";

// Alignment is optional enrichment. Bad/stale maps must never make a readable
// translation unusable, including maps loaded from an older offline cache.
export function validAlignments(
  value: unknown,
  chapter: BilingualChapter,
): Record<string, SentenceAlignment> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, SentenceAlignment> = {};
  for (const unit of chapter.units) {
    const candidate = (value as Record<string, unknown>)[unit.id];
    if (
      isSentenceAlignment(candidate, unit.text, chapter.translations[unit.id])
    )
      result[unit.id] = candidate;
  }
  return result;
}

export function isSentenceAlignment(
  value: unknown,
  sourceText: string,
  translatedText: string | undefined,
): value is SentenceAlignment {
  if (!value || typeof value !== "object") return false;
  const map = value as Record<string, unknown>;
  if (
    typeof translatedText !== "string" ||
    map.version !== 2 ||
    map.sourceText !== sourceText ||
    map.translatedText !== translatedText ||
    !Array.isArray(map.groups)
  )
    return false;
  const ids = new Set<string>();
  const occupied = {
    source: [] as { start: number; end: number }[],
    translation: [] as { start: number; end: number }[],
  };
  for (const value of map.groups as unknown[]) {
    if (!value || typeof value !== "object") return false;
    const group = value as Record<string, unknown>;
    if (typeof group.id !== "string" || ids.has(group.id)) return false;
    ids.add(group.id);
    for (const side of ["source", "translation"] as const) {
      const spans = group[side];
      const text = side === "source" ? sourceText : translatedText;
      if (!Array.isArray(spans) || !spans.length) return false;
      for (const value of spans as unknown[]) {
        if (!value || typeof value !== "object") return false;
        const span = value as Record<string, unknown>;
        if (
          typeof span.start !== "number" ||
          typeof span.end !== "number" ||
          !Number.isInteger(span.start) ||
          !Number.isInteger(span.end) ||
          span.start < 0 ||
          span.end <= span.start ||
          span.end > text.length
        )
          return false;
        const { start, end } = span;
        // Do not split a surrogate pair, even if malformed cache data asks us to.
        for (const offset of [start, end]) {
          const code = text.charCodeAt(offset);
          if (code >= 0xdc00 && code <= 0xdfff) return false;
        }
        if (
          occupied[side].some(
            (other) => start < other.end && end > other.start,
          )
        )
          return false;
        occupied[side].push({ start, end });
      }
    }
  }
  return true;
}
