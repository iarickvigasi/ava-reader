import type { ReaderChapter } from '../../reader-types';
import type { ReaderLinkTarget } from '../../reader-link-target';
import { sourceBlockParts } from './source-block-parts';
import { resolveBlockLinks } from './resolve-block-links';

// Resolve authored relative references before grouping, then relocate their stable
// block destinations. Moved blocks retain their original document's source base.
export function remapEpubLinks(chapters: ReaderChapter[]): ReaderChapter[] {
  const owners = new Map<string, string>();
  for (const chapter of chapters) {
    for (const part of sourceBlockParts(chapter.blocks)) {
      if (owners.has(part.id))
        throw new Error('The EPUB has an ambiguous block destination.');
      owners.set(part.id, chapter.chapterId);
    }
  }
  const target = (before: ReaderLinkTarget): ReaderLinkTarget => {
    const chapterId = owners.get(before.blockId);
    if (!chapterId)
      throw new Error(
        'The EPUB has a missing block destination after grouping.',
      );
    return chapterId === before.chapterId ? before : { ...before, chapterId };
  };
  const item = <T extends { target?: ReaderLinkTarget }>(before: T): T =>
    before.target ? { ...before, target: target(before.target) } : before;
  return chapters.map((chapter) => ({
    ...chapter,
    blocks: resolveBlockLinks(chapter.blocks, item, item, target),
  }));
}
