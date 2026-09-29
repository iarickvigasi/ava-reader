import { fixture } from './package.fixture';
import { relabelPackage } from './relabel-package';
import { relabelIndex } from './relabel-index';

it('updates only labels, preserves content identity, and is idempotent', () => {
  const original = fixture();
  const { readerPackage, changes } = relabelPackage(original);
  expect(readerPackage.chapters.map((c) => c.label)).toEqual([
    '1. It was a bright cold day…',
    '2.',
  ]);
  expect(readerPackage.toc[0].label).toBe(readerPackage.chapters[0].label);
  expect(readerPackage.manifest).toBe(original.manifest);
  expect(readerPackage.chapters[0].blocks).toBe(original.chapters[0].blocks);
  expect(readerPackage.chapters[0]).toMatchObject({
    chapterId: 'c0',
    href: 'c0.xhtml',
    nextChapterId: 'c1',
  });
  expect(changes).toHaveLength(2);
  expect(original.chapters[0].label).toBe('Chapter 1');
  expect(relabelPackage(readerPackage).changes).toEqual([]);
});

it('keeps meaningful titles, mismatched numbering, and authored TOC labels', () => {
  const original = fixture();
  original.chapters[1].label = 'Chapter 5';
  original.toc[0].label = 'Introduction';
  const result = relabelPackage(original);
  expect(result.readerPackage.chapters[1]).toBe(original.chapters[1]);
  expect(result.readerPackage.toc[0].label).toBe('Introduction');
  original.chapters[0].label = 'Opening';
  expect(relabelPackage(original).changes).toEqual([]);
});

it('preserves progress analysis flags and null indexes', () => {
  const original = fixture();
  const { changes } = relabelPackage(original);
  const index = {
    version: 2,
    totalBlocks: 1,
    bodyBlocks: 0,
    chapters: [
      {
        chapterId: 'c0',
        blockIds: ['c0::b1'],
        counted: false,
        label: 'Chapter 1',
        title: 'Book',
      },
    ],
    toc: JSON.parse(JSON.stringify(original.toc)) as [],
  };
  expect(relabelIndex(index, changes)).toMatchObject({
    version: 2,
    bodyBlocks: 0,
    chapters: [
      { counted: false, blockIds: ['c0::b1'], label: changes[0].after },
    ],
    toc: [{ label: changes[0].after }],
  });
  expect(relabelIndex(null, changes)).toBeNull();
  expect(() => relabelIndex({}, changes)).toThrow('Invalid progress index');
});
