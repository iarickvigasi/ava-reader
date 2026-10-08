import { useReaderMeasurement } from "./reader-measurement-context";
import { ReaderInternalLink } from "./reader-internal-link";
import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderInlineImage } from "./reader-inline-image";
import { ReaderContentLink } from "./reader-content-link";
import { ReaderInlineScript } from "./reader-inline-script";
import { ReaderInlineText } from "./reader-inline-text";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";

const LINK_CLASS = "underline decoration-line/60 underline-offset-4";

// Preserve each run's styling/script inside its semantic occurrence's link.
export function ReaderInlineContent({ inlines }: { inlines: ReaderInline[] }) {
  const measurement = useReaderMeasurement();
  return (
    <>
      {groupInlineLinkOccurrences(inlines).map((group) => {
        const key = `${group.kind}-${group.sourceIndex}`;

        if (group.kind === "image") {
          return (
            <ReaderContentLink key={key} link={group.inline}>
              <ReaderInlineImage inline={group.inline} />
            </ReaderContentLink>
          );
        }

        const inline = group.inlines[0];
        const content = group.inlines.map((run, index) => (
          <ReaderInlineScript
            key={index}
            inheritSize={run.presentation?.relative_size != null}
            script={
              run.script ??
              (run.presentation?.vertical_align === "super" ||
              run.presentation?.vertical_align === "sub"
                ? run.presentation.vertical_align
                : undefined)
            }
          >
            <ReaderInlineText inline={run} />
          </ReaderInlineScript>
        ));

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
