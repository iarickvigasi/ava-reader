import {
  Injectable,
  Inject,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#catalog-client';

@Injectable()
export class CatalogDatabase
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Optional()
    @Inject('CATALOG_STATEMENT_TIMEOUT_MS')
    statementTimeoutMs = 5000,
  ) {
    const connectionString = process.env.CATALOG_DATABASE_URL;
    if (!connectionString) throw new Error('CATALOG_DATABASE_URL is required');
    super({
      adapter: new PrismaPg({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 5000,
        statement_timeout: statementTimeoutMs,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
