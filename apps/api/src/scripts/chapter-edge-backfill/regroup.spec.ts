import { setup } from './edge.fixture';
import { planGroups } from '../../reader/epub/edge-grouping/plan-groups';
import { regroupPackage } from '../../reader/epub/edge-grouping/regroup-package';

it('groups edges, keeps Contents separate, and preserves every block and middle ID', () => {
  const { pkg, source } = setup([
    'front',
    'front',
    'contents',
    'unknown',
    'back',
    'footnote',
    'footnote',
    'back',
  ]);
  const groups = planGroups(pkg, source);
  const result = regroupPackage(pkg, groups);
  expect(groups.map((g) => g.chapterIds)).toEqual([
    ['c0', 'c1'],
    ['c5', 'c6'],
  ]);
  expect(result.chapters.map((c) => c.chapterId)).toEqual([
    'c0',
    'c2',
    'c3',
    'c4',
    'c5',
    'c7',
  ]);
  expect(result.chapters.flatMap((c) => c.blocks)).toEqual(
    pkg.chapters.flatMap((c) => c.blocks),
  );
  expect(result.chapters[2]).toMatchObject({
    chapterId: 'c3',
    blocks: pkg.chapters[3].blocks,
    previousChapterId: 'c2',
    nextChapterId: 'c4',
  });
  expect(result.toc.map((n) => n.label)).toEqual([
    'Front matter',
    'Chapter 1',
    'Chapter 1',
    'Chapter 1',
    'Footnotes',
    'Chapter 1',
  ]);
  expect(result.manifest).toEqual({ ...pkg.manifest, totalChapters: 6 });
  expect(planGroups(result, source)).toEqual([]);
});

it('does not group middle footnotes, short unknown chapters, or sections after uncertain endings', () => {
  const { pkg, source } = setup([
    'unknown',
    'front',
    'front',
    'footnote',
    'footnote',
    'unknown',
  ]);
  expect(planGroups(pkg, source)).toEqual([]);
});

it('does not classify an entire split source document by one subsection', () => {
  const { pkg, source } = setup(['front', 'front', 'unknown']);
  pkg.chapters[1].href = 'c0.xhtml#body';
  expect(planGroups(pkg, source)).toEqual([]);
});

it('keeps nested middle TOC entries and fixes their sequence indices', () => {
  const { pkg, source } = setup(['front', 'front', 'unknown']);
  pkg.toc[2].children = [{ ...pkg.toc[2], id: 'sub', label: 'Section' }];
  const result = regroupPackage(pkg, planGroups(pkg, source));
  expect(result.toc[1].children[0]).toEqual({
    ...pkg.toc[2].children[0],
    spineIndex: 1,
  });
});

it('places missing opening contents entries before the main body', () => {
  const { pkg, source } = setup(['front', 'front', 'unknown']);
  pkg.toc = [pkg.toc[2]];
  const result = regroupPackage(pkg, planGroups(pkg, source));
  expect(result.toc.map((node) => node.chapterId)).toEqual(['c0', 'c2']);
});
