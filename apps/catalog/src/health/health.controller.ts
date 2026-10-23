import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';

@Controller('health')
export class HealthController {
  constructor(private readonly db: CatalogDatabase) {}

  @Get()
  async check() {
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Catalog database unavailable');
    }
    return { status: 'ok', service: 'catalog', database: 'up' };
  }
}
