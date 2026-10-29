import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CatalogDatabase } from '../../database/catalog-database';
import { verifyPublication } from './verify-publication';
import { applyPublication } from './apply-publication';

@Controller('reading-assets/publication')
export class PublicationController {
  constructor(private readonly db: CatalogDatabase) {}
  @Post()
  async receive(
    @Body() body: Parameters<typeof applyPublication>[1],
    @Headers('x-reading-timestamp') timestamp: string,
    @Headers('x-reading-signature') signature: string,
  ) {
    verifyPublication(body, timestamp, signature);
    return {
      ...(await applyPublication(this.db, body)),
      entryId: body.entryId,
      revision: body.revision,
    };
  }
}
