import type { CSSProperties } from "react";
import type { ReaderBlock, ReaderBlockAlign } from "@/lib/api-types";

// Default first-line indent for paragraphs that don't have one set on
// the block. Books that ship no styling at all still look book-like;
// books that DO style their paragraphs (Dune-style stylesheets with
// .indent / .nonindent) override this via block.textIndent.
const DEFAULT_PARAGRAPH_INDENT_EM = 1.5;

// `text-left` is the default; we omit it so the class string stays
// short and Tailwind's purge isn't tripped up by a no-op class.
const ALIGNMENT_CLASS_BY_VALUE: Record<ReaderBlockAlign, string> = {
  center: "text-center",
  justify: "text-justify",
  left: "",
  right: "text-right",
};

// Resolves the inline style for a block: a per-block font-size
// multiplier (--reader-block-scale, picked up by calc() classes), an
// explicit text-indent for paragraphs, and a publisher-supplied
// font-weight. Inline styles override utility classes on purpose — a
// heading's default `font-bold` should give way to `font-weight: 600`
// when the source asks for semibold.
export function resolveBlockStyle(block: ReaderBlock): CSSProperties | undefined {
  const style: Record<string, unknown> = {};

  if ("fontSizeScale" in block && block.fontSizeScale) {
    style["--reader-block-scale"] = block.fontSizeScale;
  }

  const indentEm = resolveParagraphIndentEm(block);
  if (indentEm > 0) {
    style.textIndent = `${indentEm}em`;
  }

  if ("fontWeight" in block && typeof block.fontWeight === "number") {
    style.fontWeight = block.fontWeight;
  }

  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}

export function resolveAlignmentClass(block: ReaderBlock): string {
  if (!("align" in block) || !block.align) {
    return "";
  }
  return ALIGNMENT_CLASS_BY_VALUE[block.align] ?? "";
}

function resolveParagraphIndentEm(block: ReaderBlock): number {
  if (block.kind !== "paragraph") {
    return 0;
  }

  // Indenting a centered or right-aligned paragraph reads as a glitch.
  const align = "align" in block ? block.align : undefined;
  if (align === "center" || align === "right") {
    return 0;
  }

  // Publisher-supplied value wins. textIndent === 0 means "explicitly
  // no indent" (e.g. .nonindent on the first paragraph after a
  // heading) and must be respected.
  if ("textIndent" in block && typeof block.textIndent === "number") {
    return block.textIndent;
  }

  return DEFAULT_PARAGRAPH_INDENT_EM;
}
