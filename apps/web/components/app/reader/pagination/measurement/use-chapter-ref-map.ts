import { useMemo, useRef } from "react";

// Read/write view of a chapterId → DOM node map.
export type ChapterRefMap<T extends Element> = {
  get: (chapterId: string) => T | null;
  setRef: (chapterId: string, node: T | null) => void;
};

// Read-only view — all the measurement loop needs.
export type ChapterRefReader<T extends Element> = Pick<ChapterRefMap<T>, "get">;

// Stable map of chapterId → DOM node, exposed as a get/setRef pair so callbacks
// reading from it don't need to be re-bound on every render.
export function useChapterRefMap<T extends Element>(): ChapterRefMap<T> {
  const refs = useRef(new Map<string, T>());

  return useMemo<ChapterRefMap<T>>(
    () => ({
      get: (chapterId) => refs.current.get(chapterId) ?? null,
      setRef: (chapterId, node) => {
        if (node) {
          refs.current.set(chapterId, node);
        } else {
          refs.current.delete(chapterId);
        }
      },
    }),
    [],
  );
}
