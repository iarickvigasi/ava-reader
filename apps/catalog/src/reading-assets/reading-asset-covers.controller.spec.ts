import { BadRequestException } from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { ReadingAssetCoversController } from './reading-asset-covers.controller';
import { WORK_COVER_SELECT } from '../works/work-cover-select';

const findMany = jest.fn();
const controller = new ReadingAssetCoversController({
  readingAsset: { findMany },
} as unknown as CatalogDatabase);
beforeEach(() => jest.resetAllMocks());

it('maps only ready assets by explicit entry IDs using Explore cover precedence', async () => {
  findMany.mockResolvedValue([
    {
      mainCatalogEntryId: 'public',
      edition: {
        work: {
          coverImageUrl: 'work.jpg',
          editions: [{ coverImageUrl: 'edition.jpg' }],
        },
      },
    },
    {
      mainCatalogEntryId: 'fallback',
      edition: {
        work: {
          coverImageUrl: null,
          editions: [{ coverImageUrl: 'edition.jpg' }],
        },
      },
    },
    {
      mainCatalogEntryId: 'missing',
      edition: { work: { coverImageUrl: null, editions: [] } },
    },
  ]);
  expect(await controller.covers('public,fallback,missing')).toEqual({
    items: [
      { entryId: 'public', coverImageUrl: 'work.jpg' },
      { entryId: 'fallback', coverImageUrl: 'edition.jpg' },
      { entryId: 'missing', coverImageUrl: null },
    ],
  });
  expect(findMany).toHaveBeenCalledWith({
    where: {
      status: 'READY',
      mainCatalogEntryId: { in: ['public', 'fallback', 'missing'] },
    },
    distinct: ['mainCatalogEntryId'],
    orderBy: { id: 'asc' },
    take: 3,
    select: {
      mainCatalogEntryId: true,
      edition: { select: { work: { select: WORK_COVER_SELECT } } },
    },
  });
});

it.each([
  undefined,
  '',
  '../private',
  ['entry'],
  Array.from({ length: 21 }, (_, i) => `entry-${i}`).join(','),
])('rejects malformed or unbounded IDs: %s', async (ids) => {
  await expect(controller.covers(ids)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  expect(findMany).not.toHaveBeenCalled();
});
