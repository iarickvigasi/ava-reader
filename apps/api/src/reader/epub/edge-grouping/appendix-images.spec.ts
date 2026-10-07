import { setup } from '../../../scripts/chapter-edge-backfill/edge.fixture';
import { planGroups } from './plan-groups';
import { regroupPackage } from './regroup-package';

it('backfills appendix images before an extract and revisits version 2', () => {
  const { pkg, source } = setup([
    'unknown',
    'appendix',
    'unknown',
    'unknown',
    'unknown',
  ]);
  pkg.chapters[1].label = 'Appendix';
  for (const i of [2, 3])
    pkg.chapters[i].blocks = [
      { kind: 'image', id: `image-${i}`, text: '', alt: null, src: 'art' },
    ];
  const original = { ...pkg, edgeGroupingVersion: 2 };
  const groups = planGroups(original, source);
  expect(groups).toEqual([
    { label: 'Appendix', chapterIds: ['c1', 'c2', 'c3'] },
  ]);
  const result = regroupPackage(original, groups);
  expect(result.chapters.map((chapter) => chapter.chapterId)).toEqual([
    'c0',
    'c1',
    'c4',
  ]);
  expect(result.chapters.flatMap((chapter) => chapter.blocks)).toEqual(
    pkg.chapters.flatMap((chapter) => chapter.blocks),
  );
  expect(planGroups(result, source)).toEqual([]);
});

it('does not absorb text or unrelated picture runs into an appendix', () => {
  const { pkg, source } = setup(['unknown', 'appendix', 'unknown', 'unknown']);
  pkg.chapters[3].blocks = [
    { kind: 'image', id: 'art', text: '', alt: null, src: 'art' },
  ];
  expect(planGroups(pkg, source)).toEqual([]);
});
