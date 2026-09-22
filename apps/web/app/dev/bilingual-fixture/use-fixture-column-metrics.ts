import { useEffect, useState, type RefObject } from "react";

const SELECTOR = "[data-bilingual-column]";
type Counts = { source: number; translation: number };

export function useFixtureColumnMetrics(
  rootRef: RefObject<HTMLDivElement | null>,
) {
  const [metrics, setMetrics] = useState({ removals: 0, remounts: 0 });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const seen = new WeakSet<Element>();
    const removed = new WeakSet<Element>();
    const mounts: Counts = { source: 0, translation: 0 };
    let removals = 0;
    const inspect = (records: MutationRecord[]) => {
      let changed = false;
      for (const record of records)
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue;
          const columns = [
            ...(node.matches(SELECTOR) ? [node] : []),
            ...node.querySelectorAll(SELECTOR),
          ];
          for (const column of columns)
            if (seen.has(column) && !removed.has(column)) {
              removed.add(column);
              removals += 1;
              changed = true;
            }
        }
      for (const column of root.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (seen.has(column)) continue;
        seen.add(column);
        const side = column.dataset.bilingualColumn;
        if (side === "source" || side === "translation") {
          mounts[side] += 1;
          changed = true;
        }
      }
      if (changed)
        setMetrics({
          removals,
          remounts:
            Math.max(0, mounts.source - 1) +
            Math.max(0, mounts.translation - 1),
        });
    };
    inspect([]);
    const observer = new MutationObserver(inspect);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [rootRef]);
  return metrics;
}
