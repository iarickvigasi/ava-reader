import type { MouseEvent, ReactNode } from "react";
import type { ReaderLinkTarget } from "@/lib/api-types/reader-content";
import { useReaderNavigationActions } from "../state/reader-navigation-context";

export function ReaderInternalLink({
  target,
  sourceOffset = 0,
  children,
}: {
  target: ReaderLinkTarget;
  sourceOffset?: number;
  children: ReactNode;
}) {
  const navigation = useReaderNavigationActions();
  const activate = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const block = event.currentTarget.closest<HTMLElement>(
      "[data-reader-block='true']",
    );
    const chapterId = block?.dataset.chapterId,
      blockId = block?.dataset.blockId;
    if (navigation && chapterId && blockId)
      navigation.jump(target, { chapterId, blockId, textOffset: sourceOffset });
  };
  return (
    <a
      href={`#reader-${target.chapterId}-${target.blockId}`}
      role={target.note ? "doc-noteref" : undefined}
      className="underline decoration-line/60 underline-offset-4 hover:text-title"
      onClick={activate}
    >
      {children}
    </a>
  );
}
