import type { CSSProperties } from "react";
import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderBreakableText } from "./reader-breakable-text";

const READER_INLINE_KIND_IMAGE = "image";

// When the source EPUB carries an explicit numeric font-weight, render
// it via inline style so it overrides the `font-bold` Tailwind class.
// Falls back to the bold class when only the boolean flag is set.
function resolveInlineStyle(
  inline: Extract<ReaderInline, { kind: "text" }>,
): CSSProperties | undefined {
  if (typeof inline.fontWeight === "number") {
    return { fontWeight: inline.fontWeight };
  }
  return undefined;
}

export function ReaderInlineContent({ inlines }: { inlines: ReaderInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.kind}-${index}`;

        if (inline.kind === READER_INLINE_KIND_IMAGE) {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={inline.alt ?? ""}
              // max-w-full: an inline image wider than the column would
              // overflow into the next page exactly as a long word does.
              className="mx-1 inline-block max-h-32 max-w-full align-middle"
              src={inline.src}
            />
          );

          return inline.href ? (
            <a
              key={key}
              href={inline.href}
              className="underline decoration-line/60 underline-offset-4"
            >
              {image}
            </a>
          ) : (
            <span key={key}>{image}</span>
          );
        }

        const inlineStyle = resolveInlineStyle(inline);
        const content = (
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

        return inline.href ? (
          <a
            key={key}
            href={inline.href}
            className="underline decoration-line/60 underline-offset-4 hover:text-title"
          >
            {content}
          </a>
        ) : (
          <span key={key}>{content}</span>
        );
      })}
    </>
  );
}
