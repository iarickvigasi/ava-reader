export const UNTITLED = '(untitled)';

const MAX_TITLE_LENGTH = 80;

// Spine filenames and generic section markers that carry no meaning.
const FILENAME_PATTERN = /\.(x?html?|xml)$/i;
const MACHINE_LABEL_PATTERN =
  /^(section|split|part|item|text|page)[\s_.-]*\d+$/i;
const NUMERIC_ONLY_PATTERN = /^[\d\s.:_-]+$/;

/**
 * Chapter titles are untrusted input.
 *
 * When a book has no usable TOC and no extractable heading,
 * `resolveChapterFallbackLabel` fabricates `Chapter <spineIndex + 1>`. A
 * bibliography can therefore arrive labelled "Chapter 41" — not a missing
 * title but a confidently wrong one, which a model will happily over-trust.
 *
 * Dropping a title that exactly equals the synthesized value is lossless: it
 * conveys nothing beyond the position, which the digest already sends as its
 * own signal. A real TOC label of "Chapter 5" sitting at a different spine
 * index survives, because there it genuinely means "numbered body chapter".
 */
export function normalizeChapterTitle(input: {
  label: null | string;
  spineIndex: number;
  title: null | string;
}): string {
  const synthesized = `chapter ${input.spineIndex + 1}`;

  for (const candidate of [input.title, input.label]) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed.toLowerCase() === synthesized) {
      continue;
    }

    if (isMachineGenerated(trimmed)) {
      continue;
    }

    return trimmed.length > MAX_TITLE_LENGTH
      ? `${trimmed.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
      : trimmed;
  }

  return UNTITLED;
}

function isMachineGenerated(title: string) {
  return (
    FILENAME_PATTERN.test(title) ||
    MACHINE_LABEL_PATTERN.test(title) ||
    NUMERIC_ONLY_PATTERN.test(title)
  );
}
