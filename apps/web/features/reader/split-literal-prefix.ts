import type { ReaderInline } from "@/lib/api-types/reader-content";

// Presentation-only UTF-16 split. Retain every character and semantic caller offset.
export function splitLiteralPrefix(
  inlines: readonly ReaderInline[],
  end: number,
) {
  const prefix: ReaderInline[] = [],
    body: ReaderInline[] = [];
  let offset = 0;
  for (const inline of inlines) {
    if (inline.kind === "image") {
      (offset < end ? prefix : body).push(inline);
      continue;
    }
    const cut = Math.max(0, Math.min(inline.text.length, end - offset));
    if (cut) prefix.push({ ...inline, text: inline.text.slice(0, cut) });
    if (cut < inline.text.length)
      body.push({ ...inline, text: inline.text.slice(cut) });
    offset += inline.text.length;
  }
  return { prefix, body };
}
