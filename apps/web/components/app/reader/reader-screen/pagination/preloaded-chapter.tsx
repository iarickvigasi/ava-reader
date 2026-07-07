import type { CSSProperties } from "react";
import { useCallback } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { ReaderArticle } from "../content/reader-article";
import type { ChapterRefMap } from "./use-chapter-ref-map";

// One chapter rendered offscreen for measurement. Registers its article and
// page-box nodes into the shared ref maps so the measurement loop can read them.
export function PreloadedChapter({
  articleStyle,
  chapter,
  pageBoxHeight,
  pageBoxWidth,
  setArticleRef,
  setPageBoxRef,
}: {
  articleStyle: CSSProperties;
  chapter: ReaderChapterPayload;
  pageBoxHeight: number;
  pageBoxWidth: number;
  setArticleRef: ChapterRefMap<HTMLElement>["setRef"];
  setPageBoxRef: ChapterRefMap<HTMLDivElement>["setRef"];
}) {
  const handlePageBoxRef = useCallback(
    (node: HTMLDivElement | null) => setPageBoxRef(chapter.chapterId, node),
    [chapter.chapterId, setPageBoxRef],
  );
  const handleArticleRef = useCallback(
    (node: HTMLElement | null) => setArticleRef(chapter.chapterId, node),
    [chapter.chapterId, setArticleRef],
  );

  return (
    <div
      ref={handlePageBoxRef}
      className="overflow-hidden"
      style={{
        height: `${pageBoxHeight}px`,
        width: `${pageBoxWidth}px`,
      }}
    >
      <ReaderArticle
        articleRef={handleArticleRef}
        blocks={chapter.blocks}
        chapterId={chapter.chapterId}
        pageHeight={pageBoxHeight}
        style={articleStyle}
      />
    </div>
  );
}
