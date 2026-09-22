import { useLayoutEffect, useRef, useState } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { measurePairs } from "./measure-pairs";
import {
  resolveMeasurementSnapshot,
  type PairMeasurementSnapshot,
} from "./measurement-snapshot";

export function usePairMeasurements(
  chapter: BilingualChapter | null,
  size: { width: number; height: number },
  fontScale: number,
) {
  const measurementRef = useRef<HTMLDivElement>(null);
  const geometryCache = useRef({ key: "", values: new Map<string, number>() });
  const key = `${size.width}:${size.height}:${fontScale}`;
  const [snapshot, setSnapshot] = useState<PairMeasurementSnapshot<
    ReturnType<typeof measurePairs>
  > | null>(null);
  useLayoutEffect(() => {
    if (!chapter || !size.width || !size.height) return;
    let frame = 0;
    let forceRemeasure = false;
    const measure = (clearCache = false) => {
      forceRemeasure ||= clearCache;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = measurementRef.current;
        if (!root) return;
        const source = root
          .querySelector<HTMLElement>("[data-natural='source']")
          ?.getBoundingClientRect();
        const cacheKey = `${chapter.libraryItemId}:${chapter.contentRevision}:${chapter.translationVersion}:${chapter.chapterId}:${chapter.targetLang}:${key}:${source?.width}:${source?.height}`;
        if (forceRemeasure || geometryCache.current.key !== cacheKey) {
          geometryCache.current = { key: cacheKey, values: new Map() };
        }
        forceRemeasure = false;
        setSnapshot({
          chapter,
          key,
          result: measurePairs(
            root,
            chapter,
            size.width,
            size.height,
            geometryCache.current.values,
          ),
        });
      });
    };
    const root = measurementRef.current;
    const observer = new ResizeObserver(() => measure());
    const onAssetLoad = () => measure(true);
    if (root) observer.observe(root);
    document.fonts?.addEventListener("loadingdone", onAssetLoad);
    root?.addEventListener("load", onAssetLoad, true);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.fonts?.removeEventListener("loadingdone", onAssetLoad);
      root?.removeEventListener("load", onAssetLoad, true);
    };
  }, [chapter, key, size.width, size.height]);
  return {
    measurementRef,
    layoutKey: key,
    ...resolveMeasurementSnapshot(snapshot, chapter, key),
  };
}
