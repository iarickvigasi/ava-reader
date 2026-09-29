import { canonicalStyle } from "@/features/reader/canonical/style";
import type { CSSProperties } from "react";
import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderBreakableText } from "./reader-breakable-text";

type TextInline = Extract<ReaderInline, { kind: "text" }>;

// When the source EPUB carries an explicit numeric font-weight, render
// it via inline style so it overrides the `font-bold` Tailwind class.
// Falls back to the bold class when only the boolean flag is set.
function resolveInlineStyle(inline: TextInline): CSSProperties | undefined {
  const presentation = canonicalStyle(inline.presentation);
  // The semantic sup/sub wrapper already moves the baseline. Applying the
  // token again to its child would raise/lower the same glyph twice.
  if (["super", "sub"].includes(inline.presentation?.vertical_align ?? ""))
    delete presentation.verticalAlign;
  if (typeof inline.fontWeight === "number") {
    return {
      fontWeight: inline.fontWeight,
      ...presentation,
    };
  }
  return inline.presentation ? presentation : undefined;
}

export function ReaderInlineText({ inline }: { inline: TextInline }) {
  const inlineStyle = resolveInlineStyle(inline);

  return (
    <span
      className={cn(
        // Only apply the bold class when no numeric weight was
        // supplied — otherwise the inline style takes over.
        inline.bold && inlineStyle === undefined && "font-bold",
        inline.italic && "italic",
      )}
      style={inlineStyle}
    >
      <ReaderBreakableText text={inline.text} />
    </span>
  );
}
