import { collectTocChapterEntries } from "@/features/reader/toc";
import type { ReaderTocNode } from "@/lib/api-types/reader";

export function patchLegacyLabels(
  toc: ReaderTocNode[],
  source: ReaderTocNode[],
) {
  const labels = collectTocChapterEntries(source);
  const nodesById = indexNodes(source);
  let changed = false;
  const visit = (nodes: ReaderTocNode[]): ReaderTocNode[] =>
    nodes.map((node) => {
      const sourceNode = nodesById.get(node.id);
      const sameTarget =
        sourceNode &&
        sourceNode.chapterId === node.chapterId &&
        sourceNode.anchorId === node.anchorId &&
        sourceNode.blockId === node.blockId &&
        sourceNode.href === node.href;
      const next = hasEncodedLabel(node)
        ? sameTarget
          ? sourceNode
          : undefined
        : node.chapterId
          ? labels.get(node.chapterId)
          : undefined;
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
    hasEncodedLabel(node) ||
    (node.spineIndex !== null &&
      node.label.trim().toLowerCase() === `chapter ${node.spineIndex + 1}`)
  );
}

export function hasLegacyLabels(toc: ReaderTocNode[]): boolean {
  return toc.some(
    (node) => isLegacyLabel(node) || hasLegacyLabels(node.children),
  );
}

// Match the references normalized by the API's persisted-package reader.
// Fetch canonical labels instead of decoding locally or interpreting HTML.
function hasEncodedLabel(node: ReaderTocNode): boolean {
  return /&(?:#[0-9]+|#[xX][0-9a-fA-F]+|amp|apos|gt|lt|quot);/.test(node.label);
}

function indexNodes(
  nodes: ReaderTocNode[],
  result = new Map<string, ReaderTocNode>(),
) {
  for (const node of nodes) {
    result.set(node.id, node);
    indexNodes(node.children, result);
  }
  return result;
}
