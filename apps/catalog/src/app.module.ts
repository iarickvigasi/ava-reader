import { Module } from '@nestjs/common';
import { CatalogDatabase } from './database/catalog-database';
import { WorksController } from './works/works.controller';
import { WorksService } from './works/works.service';
import { AuthorsController } from './authors/authors.controller';
import { AuthorsService } from './authors/authors.service';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [WorksController, AuthorsController, HealthController],
  providers: [CatalogDatabase, WorksService, AuthorsService],
})
export class AppModule {}
