import type { ReaderPackage } from '../../reader/reader-types';

export const fixture = (): ReaderPackage => ({
  version: 2,
  manifest: {
    authors: [],
    language: 'en',
    title: 'Book',
    sourceChecksum: 'same',
    totalBlocks: 1,
    totalChapters: 2,
  },
  chapters: [0, 1].map((spineIndex) => ({
    chapterId: `c${spineIndex}`,
    spineIndex,
    href: `c${spineIndex}.xhtml`,
    label: `Chapter ${spineIndex + 1}`,
    title: 'Book',
    nextChapterId: spineIndex === 0 ? 'c1' : null,
    previousChapterId: spineIndex === 1 ? 'c0' : null,
    blocks: spineIndex
      ? []
      : [
          {
            id: 'c0::b1',
            kind: 'paragraph',
            text: 'It was a bright cold day in April.',
            inlines: [],
          },
        ],
  })),
  toc: [
    {
      id: 'toc',
      chapterId: 'c0',
      label: 'Chapter 1',
      children: [],
      href: 'c0.xhtml',
      spineIndex: 0,
      anchorId: null,
      blockId: 'c0::b1',
    },
  ],
});
