import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { verifyPublication } from '../reading-assets/publication/verify-publication';
import { reassignEdition } from './reassign-edition';
@Controller('internal/edition-work')
export class EditionWorkController {
  constructor(private readonly db: CatalogDatabase) {}
  @Post()
  link(
    @Body()
    body: {
      editionId: string;
      workId: string;
      revision: number;
      workRevision: number;
    },
    @Headers('x-reading-timestamp') timestamp: string,
    @Headers('x-reading-signature') signature: string,
  ) {
    verifyPublication(body, timestamp, signature);
    if (
      !body ||
      ![body.editionId, body.workId].every((id) =>
        /^[a-f\d-]{36}$/i.test(id),
      ) ||
      ![body.revision, body.workRevision].every(
        (revision) => Number.isSafeInteger(revision) && revision > 0,
      )
    )
      throw new BadRequestException('Invalid work/edition link');
    return reassignEdition(
      this.db,
      body.editionId,
      body.workId,
      body.revision,
      body.workRevision,
    );
  }
}
