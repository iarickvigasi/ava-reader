import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { READY_READING_ASSET } from '../works/ready-reading-assets';
import { WORK_COVER_SELECT } from '../works/work-cover-select';

@Controller('reading-assets')
export class ReadingAssetCoversController {
  constructor(private readonly db: CatalogDatabase) {}

  @Get('covers')
  async covers(@Query('entryIds') value: unknown) {
    if (typeof value !== 'string')
      throw new BadRequestException('Invalid entryIds');
    const entryIds = [...new Set(value.split(','))];
    if (
      entryIds.length > 20 ||
      entryIds.some((id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    )
      throw new BadRequestException('Invalid entryIds');
    const assets = await this.db.readingAsset.findMany({
      where: { ...READY_READING_ASSET, mainCatalogEntryId: { in: entryIds } },
      distinct: ['mainCatalogEntryId'],
      orderBy: { id: 'asc' },
      take: entryIds.length,
      select: {
        mainCatalogEntryId: true,
        editionId: true,
        edition: { select: { work: { select: WORK_COVER_SELECT } } },
      },
    });
    return {
      items: assets.map(
        ({ mainCatalogEntryId, editionId, edition: { work } }) => ({
          entryId: mainCatalogEntryId!,
          editionId,
          coverImageUrl:
            work.coverImageUrl ?? work.editions[0]?.coverImageUrl ?? null,
        }),
      ),
    };
  }
}
