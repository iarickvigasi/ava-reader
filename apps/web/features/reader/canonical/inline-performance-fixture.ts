import type {
  CanonicalBookV2,
  InlineSpan,
  Style,
  TextValue,
} from "@/lib/api-types/canonical-reader.generated";
import source from "./fixtures/reader-package.json";

export function inlineText(text: string, spans: InlineSpan[] = []): TextValue {
  const codepoint_utf16: TextValue["codepoint_utf16"] = [0];
  for (const point of text)
    codepoint_utf16.push(codepoint_utf16.at(-1)! + point.length);
  return {
    text,
    spans,
    codepoint_utf16,
    language: "uk",
    sha256: "0".repeat(64),
  };
}
export function inlineBook(
  content: TextValue,
  parent?: Style,
  styles: Style[] = [],
) {
  const book = structuredClone(source.book) as CanonicalBookV2;
  const block = book.blocks.find((block) => block.id === "body-one")!;
  if (!("content" in block)) throw new Error("Missing text fixture");
  block.content = content;
  block.style_id = parent?.id;
  book.styles = [...book.styles, ...(parent ? [parent] : []), ...styles];
  return book;
}
