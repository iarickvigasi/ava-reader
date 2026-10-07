import { epubSection } from './epub-section.fixture';
import { picturePackage, picture, prose } from './picture-chapters.fixture';
import { planGroups } from './edge-grouping/plan-groups';
import { regroupPackage } from './edge-grouping/regroup-package';
import { setup } from '../../scripts/chapter-edge-backfill/edge.fixture';

const cover = epubSection('cover', picture);
const title = epubSection('titlepage', '<h1>Book title</h1>');

it('groups cover, unnamed publisher picture and title on import, retaining Contents', async () => {
  const result = await picturePackage([
    cover,
    picture,
    title,
    '<h1>Contents</h1>',
    prose,
  ]);
  expect(result.chapters.map((chapter) => chapter.label)).toEqual([
    'Front matter',
    'Contents',
    'Story',
  ]);
  expect(result.chapters[0].blocks.map((block) => block.kind)).toEqual([
    'image',
    'image',
    'heading',
  ]);
});

it('keeps an image-only opening group separate from named About the Author', async () => {
  const result = await picturePackage([
    cover,
    picture,
    '<h1>About the Author</h1><p>Author biography.</p>',
    prose,
  ]);
  expect(result.chapters.map((chapter) => chapter.label)).toEqual([
    'Front matter',
    'About the Author',
    'Story',
  ]);
  expect(
    result.chapters[1].blocks.every((block) => block.kind !== 'image'),
  ).toBe(true);
});

it('groups illustrated title, copyright and epigraph pages on import', async () => {
  const result = await picturePackage([
    cover,
    picture,
    epubSection('titlepage', picture),
    epubSection('copyright-page', '<p>Copyright</p>'),
    epubSection('epigraph', '<p>Opening quotation</p>'),
    prose,
  ]);
  expect(result.chapters.map((chapter) => chapter.label)).toEqual([
    'Front matter',
    'Story',
  ]);
  expect(result.chapters[0].blocks).toHaveLength(5);
});

it('backfills the same unnamed pictures and revisits version 1 without changing blocks', () => {
  const { pkg, source } = setup(['front', 'unknown', 'front', 'unknown']);
  pkg.chapters[1].blocks = [
    { id: 'art', kind: 'image', src: 'art', alt: null, text: '' },
  ];
  const old = { ...pkg, edgeGroupingVersion: 1 };
  const groups = planGroups(old, source);
  expect(groups[0].chapterIds).toEqual(['c0', 'c1', 'c2']);
  const result = regroupPackage(old, groups);
  expect(result.chapters.flatMap((chapter) => chapter.blocks)).toEqual(
    pkg.chapters.flatMap((chapter) => chapter.blocks),
  );
  expect(planGroups(result, source)).toEqual([]);
});
