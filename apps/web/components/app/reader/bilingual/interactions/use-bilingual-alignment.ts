import {
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import {
  alignmentAt,
  alignmentRects,
  type AlignmentHit,
} from "./alignment-ranges";
import { bindBilingualAlignment } from "./bind-bilingual-alignment";

export function useBilingualAlignment(input: {
  rootRef: RefObject<HTMLElement | null>;
  chapter: BilingualChapter | null;
  pageKey: string;
  disabled: boolean;
}) {
  const { rootRef, chapter, pageKey, disabled } = input;
  const [paint, setPaint] = useState<{ key: string; rects: DOMRect[] } | null>(
    null,
  );
  const binding = useRef<ReturnType<typeof bindBilingualAlignment> | null>(
    null,
  );
  const available = !!chapter;
  const hitAt = useEffectEvent((x: number, y: number) => {
    const root = rootRef.current;
    return root && chapter ? alignmentAt(root, chapter, x, y) : null;
  });
  const show = useEffectEvent((hit: AlignmentHit | null) => {
    const root = rootRef.current;
    setPaint({
      key: pageKey,
      rects: root && chapter && hit ? alignmentRects(root, chapter, hit) : [],
    });
  });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !available || disabled) return;
    const listeners = bindBilingualAlignment(root, hitAt, show);
    binding.current = listeners;
    return () => {
      binding.current = null;
      listeners.dispose();
    };
  }, [rootRef, available, pageKey, disabled]);
  // Cache arrivals update geometry without resetting the active gesture.
  useLayoutEffect(() => {
    binding.current?.repaint();
  }, [chapter]);
  return !disabled && paint?.key === pageKey ? paint.rects : [];
}
