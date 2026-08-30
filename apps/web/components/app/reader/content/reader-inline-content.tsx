import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderInlineImage } from "./reader-inline-image";
import { ReaderInlineScript } from "./reader-inline-script";
import { ReaderInlineText } from "./reader-inline-text";

const READER_INLINE_KIND_IMAGE = "image";

const LINK_CLASS = "underline decoration-line/60 underline-offset-4";

// Dispatches each run to the component for its text type. A run's styling
// nests outwards: text, then its vertical script, then the link wrapper.
export function ReaderInlineContent({ inlines }: { inlines: ReaderInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.kind}-${index}`;

        if (inline.kind === READER_INLINE_KIND_IMAGE) {
          return inline.href ? (
            <a key={key} href={inline.href} className={LINK_CLASS}>
              <ReaderInlineImage inline={inline} />
            </a>
          ) : (
            <span key={key}>
              <ReaderInlineImage inline={inline} />
            </span>
          );
        }

        const content = (
          <ReaderInlineScript script={inline.script}>
            <ReaderInlineText inline={inline} />
          </ReaderInlineScript>
        );

        return inline.href ? (
          <a
            key={key}
            href={inline.href}
            className={cn(LINK_CLASS, "hover:text-title")}
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
