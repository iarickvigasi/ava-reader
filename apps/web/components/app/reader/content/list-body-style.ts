import type { CSSProperties } from "react";
import type { ReaderBlockBase } from "@/lib/api-types/reader-content";
import { structuredLeafStyle } from "./structured-leaf-style";

// An outside semantic marker must not share the body's first-line displacement.
// Keep legacy values intact: old union boxes cannot prove a corrected body inset.
export function listBodyStyle(item?: ReaderBlockBase): {
  item: CSSProperties;
  body: CSSProperties;
} {
  const { textIndent, marginInlineStart, ...style } = item
    ? structuredLeafStyle(item, "list")
    : {};
  // Preserve declared line displacement while reserving the marker gutter.
  // This display clearance makes no claim about an unknown legacy source baseline.
  const clearance = Math.max(0, -(em(textIndent) + em(marginInlineStart)));
  return {
    item: { ...style, textIndent: "0em" },
    body: {
      display: "block", textIndent, marginInlineStart,
      ...(clearance ? { paddingInlineStart: `${clearance}em` } : {}),
    },
  };
}

function em(value: CSSProperties["textIndent"]): number {
  if (typeof value !== "string" || !value.endsWith("em")) return 0;
  const result = Number(value.slice(0, -2));
  return Number.isFinite(result) ? result : 0;
}
