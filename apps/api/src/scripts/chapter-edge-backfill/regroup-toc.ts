import type { ReaderChapter, ReaderTocNode } from '../../reader/reader-types';
import type { EdgeGroup } from './types';

export function regroupToc(
  nodes: ReaderTocNode[],
  chapters: ReaderChapter[],
  groups: EdgeGroup[],
): ReaderTocNode[] {
  const owners = new Map(
    groups.flatMap((g) => g.chapterIds.map((id) => [id, g] as const)),
  );
  const byId = new Map(chapters.map((c) => [c.chapterId, c]));
  const emitted = new Set<EdgeGroup>();
  const result = walk(nodes);
  for (const group of groups) {
    if (emitted.has(group)) continue;
    const node = groupNode(group);
    const next = result.findIndex(
      (entry) => firstPosition(entry) > node.spineIndex!,
    );
    result.splice(next < 0 ? result.length : next, 0, node);
  }
  return result;

  function walk(entries: ReaderTocNode[]): ReaderTocNode[] {
    return entries.flatMap((node) => {
      const group = owners.get(node.chapterId ?? '');
      // Emit a group before walking descendants; this prevents duplicate group entries.
      const insert = group && !emitted.has(group) ? groupNode(group) : null;
      const children = walk(node.children);
      if (group) return insert ? [insert, ...children] : children;
      const chapter = byId.get(node.chapterId ?? '');
      return [
        {
          ...node,
          children,
          spineIndex: chapter?.spineIndex ?? node.spineIndex,
        },
      ];
    });
  }
  function groupNode(group: EdgeGroup): ReaderTocNode {
    emitted.add(group);
    const chapter = byId.get(group.chapterIds[0])!;
    return {
      id: `edge-group:${chapter.chapterId}`,
      label: group.label,
      children: [],
      chapterId: chapter.chapterId,
      href: chapter.href,
      spineIndex: chapter.spineIndex,
      anchorId: null,
      blockId: chapter.blocks[0]?.id ?? null,
    };
  }
}

function firstPosition(node: ReaderTocNode): number {
  return Math.min(
    node.spineIndex ?? Infinity,
    ...node.children.map(firstPosition),
  );
}
