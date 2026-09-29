import { collectTocChapterEntries } from "@/features/reader/toc";
import type { ReaderTocNode } from "@/lib/api-types/reader";

export function patchLegacyLabels(
  toc: ReaderTocNode[],
  source: ReaderTocNode[],
) {
  const labels = collectTocChapterEntries(source);
  let changed = false;
  const visit = (nodes: ReaderTocNode[]): ReaderTocNode[] =>
    nodes.map((node) => {
      const next = node.chapterId ? labels.get(node.chapterId) : undefined;
      const replace =
        isLegacyLabel(node) &&
        next &&
        next.spineIndex === node.spineIndex &&
        next.label.trim() &&
        next.label !== node.label &&
        !/^chapter\s+\d+$/i.test(next.label.trim());
      if (replace) changed = true;
      return {
        ...node,
        label: replace ? next.label : node.label,
        children: visit(node.children),
      };
    });
  const patched = visit(toc);
  return changed ? patched : null;
}

export function isLegacyLabel(node: ReaderTocNode): boolean {
  return (
    node.spineIndex !== null &&
    node.label.trim().toLowerCase() === `chapter ${node.spineIndex + 1}`
  );
}

export function hasLegacyLabels(toc: ReaderTocNode[]): boolean {
  return toc.some(
    (node) => isLegacyLabel(node) || hasLegacyLabels(node.children),
  );
}
