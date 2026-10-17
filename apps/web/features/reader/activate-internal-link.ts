import type { MouseEvent } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { ReaderLinkTarget } from "@/lib/api-types/reader-content";

export function activateInternalLink(
  event: MouseEvent<HTMLAnchorElement>,
  input: {
    target: ReaderLinkTarget;
    sourceOffset: number;
    jump?: (target: ReaderLocator, origin: ReaderLocator) => void;
  },
) {
  event.preventDefault();
  const block = event.currentTarget.closest<HTMLElement>(
    "[data-reader-block='true']",
  );
  const chapterId = block?.dataset.chapterId,
    blockId = block?.dataset.blockId;
  if (input.jump && chapterId && blockId)
    input.jump(input.target, {
      chapterId,
      blockId,
      textOffset: input.sourceOffset,
    });
}
