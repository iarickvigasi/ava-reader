import type { CSSProperties } from "react";
import type { ReaderBlockBase } from "@/lib/api-types/reader-content";
import { canonicalStyle } from "@/features/reader/canonical/style";
import { resolveBlockStyle } from "./reader-block-style";

// Scalar EPUB sizes use the reader's prose baseline; canonical relative sizes
// retain their existing em inheritance. Zero indentation resets the parent.
export function structuredLeafStyle(
  leaf: ReaderBlockBase,
  kind: "list" | "table",
): CSSProperties {
  const style: CSSProperties = {
    ...resolveBlockStyle({ ...leaf, kind: "aside", inlines: [] }),
  };
  if (leaf.align != null) style.textAlign = leaf.align;
  if (leaf.textIndent != null) style.textIndent = `${leaf.textIndent}em`;
  if (leaf.fontSizeScale != null) {
    Object.assign(style, { "--reader-block-scale": leaf.fontSizeScale });
    style.fontSize = `calc(var(--reader-${kind}-base,${kind === "list" ? "1.12rem" : "1rem"}) * var(--reader-font-scale) * var(--reader-block-scale,1))`;
  }
  return { ...style, ...canonicalStyle(leaf.presentation) };
}
