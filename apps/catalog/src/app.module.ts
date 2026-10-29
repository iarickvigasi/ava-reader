import { EditionCoversController } from './editions/edition-covers.controller';
import { EditionsController } from './editions/editions.controller';
import { EditionWorkController } from './linking/edition-work.controller';
import { LinkTargetController } from './linking/link-target.controller';
import { EditorialController } from './editorial/editorial.controller';
import { ReadingAssetCoversController } from './reading-assets/reading-asset-covers.controller';
import { PublicationController } from './reading-assets/publication/publication.controller';
import { PublicBlobsController } from './reading-assets/publication/blobs.controller';
import { PublicStorageGuard } from './reading-assets/publication/storage.guard';
import { BrowseService } from './works/browse.service';
import { Module } from '@nestjs/common';
import { CatalogDatabase } from './database/catalog-database';
import { WorksController } from './works/works.controller';
import { WorksService } from './works/works.service';
import { AuthorsController } from './authors/authors.controller';
import { AuthorsService } from './authors/authors.service';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [
    EditionsController,
    EditionCoversController,
    EditorialController,
    EditionWorkController,
    LinkTargetController,
    WorksController,
    AuthorsController,
    HealthController,
    ReadingAssetCoversController,
    PublicationController,
    PublicBlobsController,
  ],
  providers: [
    CatalogDatabase,
    WorksService,
    AuthorsService,
    BrowseService,
    PublicStorageGuard,
  ],
})
export class AppModule {}
