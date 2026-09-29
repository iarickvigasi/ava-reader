import type { CSSProperties } from "react";
import type { Style } from "@/lib/api-types/canonical-reader.generated";

export function canonicalStyle(style?: Style): CSSProperties {
  if (!style) return {};
  return {
    ...(style.bold == null ? {} : { fontWeight: style.bold ? 700 : 400 }),
    ...(style.italic == null
      ? {}
      : { fontStyle: style.italic ? "italic" : "normal" }),
    ...(style.small_caps == null
      ? {}
      : { fontVariant: style.small_caps ? "small-caps" : "normal" }),
    ...(style.family == null
      ? {}
      : {
          fontFamily:
            style.family === "serif"
              ? "var(--font-reader), serif"
              : style.family === "sans-serif"
                ? "var(--font-ui), sans-serif"
                : "monospace",
        }),
    ...(style.relative_size == null
      ? {}
      : { fontSize: `${style.relative_size}em` }),
    ...(style.indent_em == null ? {} : { textIndent: `${style.indent_em}em` }),
    ...(style.line_height == null ? {} : { lineHeight: style.line_height }),
    ...(style.space_before_em == null
      ? {}
      : { marginTop: `${style.space_before_em}em` }),
    ...(style.space_after_em == null
      ? {}
      : { marginBottom: `${style.space_after_em}em` }),
    ...(style.align == null ? {} : { textAlign: style.align }),
    ...(style.vertical_align == null
      ? {}
      : { verticalAlign: style.vertical_align }),
  };
}
