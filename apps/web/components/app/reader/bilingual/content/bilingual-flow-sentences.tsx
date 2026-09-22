import { Fragment } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";
import type { BilingualFlowUnit } from "@/features/reader/bilingual/content/flow-types";
import { flowSentenceParts } from "@/features/reader/bilingual/content/flow-sentence-parts";
import { flowSourceAttributes } from "@/features/reader/bilingual/content/flow-source-attributes";
import { ReaderInlineContent } from "@/components/app/reader/content/reader-inline-content";
import { BilingualSentenceSkeleton } from "../loading/bilingual-sentence-skeleton";

export function BilingualFlowSentences({
  units,
  block,
  chapter,
  side,
}: {
  units: readonly BilingualFlowUnit[];
  block: ReaderBlock;
  chapter: BilingualChapter;
  side: "source" | "translation";
}) {
  return flowSentenceParts(units, block, chapter, side).map((part) => {
    const attributes =
      side === "source"
        ? {
            ...flowSourceAttributes([part], chapter.chapterId, block.kind),
            "data-reader-block": "true",
          }
        : {};
    const sentence = (
      <span
        {...attributes}
        data-bilingual-unit-id={part.unit.id}
        data-bilingual-unit-index={part.index}
        data-bilingual-missing={part.missing || undefined}
      >
        {part.missing ? (
          <BilingualSentenceSkeleton text={part.unit.text} />
        ) : (
          <ReaderInlineContent inlines={part.inlines} />
        )}
      </span>
    );
    return (
      <Fragment key={part.unit.id}>
        <ReaderInlineContent inlines={part.before} />
        {side === "source" ? (
          <span data-bilingual-source-fragment>{sentence}</span>
        ) : (
          sentence
        )}
      </Fragment>
    );
  });
}
