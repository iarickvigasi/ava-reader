import type { CSSProperties } from "react";
import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderBreakableText } from "./reader-breakable-text";

type TextInline = Extract<ReaderInline, { kind: "text" }>;

// When the source EPUB carries an explicit numeric font-weight, render
// it via inline style so it overrides the `font-bold` Tailwind class.
// Falls back to the bold class when only the boolean flag is set.
function resolveInlineStyle(inline: TextInline): CSSProperties | undefined {
  if (typeof inline.fontWeight === "number") {
    return { fontWeight: inline.fontWeight };
  }
  return undefined;
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
