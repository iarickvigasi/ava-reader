import { createHash } from 'crypto';

// Strips wrapping quote characters (curly or straight, same kind on both ends)
// and collapses whitespace. Two selections that differ only in surrounding
// whitespace or matching quote glyphs hash to the same key — that's what we
// want for the per-user cache.
export function normalizeSelectionText(text: string): string {
  let normalized = text.replace(/\s+/g, ' ').trim();

  const QUOTE_PAIRS: Array<[string, string]> = [
    ['"', '"'],
    ['\u201C', '\u201D'],
    ['\u2018', '\u2019'],
    ["'", "'"],
  ];

  for (const [open, close] of QUOTE_PAIRS) {
    if (
      normalized.length >= 2 &&
      normalized.startsWith(open) &&
      normalized.endsWith(close)
    ) {
      normalized = normalized.slice(open.length, -close.length).trim();
      break;
    }
  }

  return normalized;
}

// Cache key for a (kind, text, targetLang, model, context, bookTitle,
// author) tuple. The `model` is folded in so a model swap doesn't quietly
// serve the previous model's output. The selection-context fields (spec 3)
// are folded in so the same phrase under different surrounding sentences —
// or in a different book — generates fresh instead of reusing the other
// location's cached answer. Requests without them hash on empty strings, so
// the degraded path stays internally consistent.
export function buildSourceHash(input: {
  kind: string;
  text: string;
  targetLang?: string | null;
  model: string;
  context?: string | null;
  bookTitle?: string | null;
  author?: string | null;
}): string {
  const normalized = normalizeSelectionText(input.text);
  const targetLang = input.targetLang ?? '';
  const context = collapseWhitespace(input.context ?? '');
  const bookTitle = collapseWhitespace(input.bookTitle ?? '');
  const author = collapseWhitespace(input.author ?? '');
  const payload = [
    input.kind,
    normalized,
    targetLang,
    input.model,
    context,
    bookTitle,
    author,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
