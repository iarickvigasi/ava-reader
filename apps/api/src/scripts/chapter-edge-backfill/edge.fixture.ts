import { fixture } from '../chapter-label-backfill/package.fixture';
import type { EdgeRole, SourceSection } from './types';

export function setup(roles: EdgeRole[]) {
  const pkg = fixture();
  pkg.chapters = roles.map((_, i) => ({
    ...pkg.chapters[0],
    chapterId: `c${i}`,
    href: `c${i}.xhtml`,
    spineIndex: i,
    blocks: [{ ...pkg.chapters[0].blocks[0], id: `c${i}::b1` }],
    previousChapterId: i ? `c${i - 1}` : null,
    nextChapterId: i < roles.length - 1 ? `c${i + 1}` : null,
  }));
  pkg.toc = pkg.chapters.map((c) => ({
    ...pkg.toc[0],
    id: `toc-${c.chapterId}`,
    chapterId: c.chapterId,
    href: c.href,
    blockId: c.blocks[0].id,
    spineIndex: c.spineIndex,
  }));
  pkg.manifest.totalBlocks = roles.length;
  pkg.manifest.totalChapters = roles.length;
  const source = new Map<string, SourceSection>(
    roles.map((role, i) => [`c${i}.xhtml`, { role, evidence: 'test' }]),
  );
  return { pkg, source };
}
