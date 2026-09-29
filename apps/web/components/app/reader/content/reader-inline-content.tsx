import { useReaderMeasurement } from "./reader-measurement-context";
import { ReaderInternalLink } from "./reader-internal-link";
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
  const measurement = useReaderMeasurement();
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.kind}-${index}`;

        if (inline.kind === READER_INLINE_KIND_IMAGE) {
          return inline.href ? (
            <a
              key={key}
              href={measurement ? undefined : inline.href}
              className={LINK_CLASS}
            >
              <ReaderInlineImage inline={inline} />
            </a>
          ) : (
            <span key={key}>
              <ReaderInlineImage inline={inline} />
            </span>
          );
        }

        const content = (
          <ReaderInlineScript
            inheritSize={inline.presentation?.relative_size != null}
            script={
              inline.script ??
              (inline.presentation?.vertical_align === "super" ||
              inline.presentation?.vertical_align === "sub"
                ? inline.presentation.vertical_align
                : undefined)
            }
          >
            <ReaderInlineText inline={inline} />
          </ReaderInlineScript>
        );

        if (inline.target)
          return (
            <ReaderInternalLink
              key={key}
              target={inline.target}
              sourceOffset={inline.sourceOffset}
            >
              {content}
            </ReaderInternalLink>
          );
        return inline.href ? (
          <a
            key={key}
            href={measurement ? undefined : inline.href}
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
