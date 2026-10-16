import { useReaderMeasurement } from "./reader-measurement-context";
import { ReaderInternalLink } from "./reader-internal-link";
import type { ReaderInline } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { ReaderInlineImage } from "./reader-inline-image";
import { ReaderContentLink } from "./reader-content-link";
import { ReaderScriptText } from "./reader-script-text";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";

import { ReaderLiteralLabel } from "./reader-literal-label";

const LINK_CLASS = "underline decoration-line/60 underline-offset-4";

// Preserve each run's styling/script inside its semantic occurrence's link.
export function ReaderInlineContent({
  inlines,
  literalLabel,
  before,
  after,
}: {
  inlines: ReaderInline[];
  literalLabel?: { end: number; columnEm: number };
  before?: string;
  after?: string;
}) {
  const measurement = useReaderMeasurement();
  if (literalLabel)
    return <ReaderLiteralLabel inlines={inlines} label={literalLabel} before={before} after={after} />;
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
        const content = group.inlines.map((run, index) => {
          const prior = inlines[group.sourceIndex + index - 1];
          const next = inlines[group.sourceIndex + index + 1];
          return (
            <ReaderScriptText
              key={index}
              inline={run}
              before={prior ? (prior.kind === "text" ? prior.text : "") : before}
              after={next ? (next.kind === "text" ? next.text : "") : after}
            />
          );
        });

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
