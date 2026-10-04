import { setup } from './edge.fixture';
import { planGroups } from './plan-groups';
import { regroupPackage } from './regroup-package';
import { regroupIndex } from './regroup-index';
import { buildReadingProgressIndex } from '../../reader/progress/reading-progress-index';
import type { Prisma } from '@prisma/client';

it('preserves progress totals and refuses incompatible counting flags', () => {
  const { pkg, source } = setup(['front', 'front', 'unknown']);
  const groups = planGroups(pkg, source);
  const index = {
    ...buildReadingProgressIndex(pkg),
    version: 2,
    bodyBlocks: 1,
    chapters: buildReadingProgressIndex(pkg).chapters.map((c, i) => ({
      ...c,
      counted: i === 2,
    })),
  };
  const result = regroupIndex(
    index as Prisma.JsonValue,
    regroupPackage(pkg, groups),
    groups,
  );
  expect(result).toMatchObject({
    version: 2,
    bodyBlocks: 1,
    totalBlocks: 3,
    chapters: [
      { chapterId: 'c0', counted: false, blockIds: ['c0::b1', 'c1::b1'] },
      { chapterId: 'c2', counted: true },
    ],
  });
  index.chapters[1].counted = true;
  expect(() => regroupIndex(index as Prisma.JsonValue, pkg, groups)).toThrow(
    'mixed',
  );
});
