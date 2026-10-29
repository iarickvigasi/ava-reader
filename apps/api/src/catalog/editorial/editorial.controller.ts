import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { catalogEditorialRequest } from './catalog-editorial-request';
import { deleteCatalogWork } from './delete-catalog-work';
import { listReviews } from '../reading-import/list-reviews';

@Controller('admin/explore')
@UseGuards(ClerkAuthGuard)
export class EditorialController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}
  @Get('authors')
  async authors(@Req() req: AuthenticatedRequest, @Query('query') query = '') {
    await this.users.assertAdmin(req.auth.clerkUserId);
    return catalogEditorialRequest({
      operation: 'search',
      kind: 'authors',
      query,
    });
  }
  @Get('works/:id/reviews')
  async reviews(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.users.assertAdmin(req.auth.clerkUserId);
    return listReviews(this.prisma, id);
  }
  @Get(':kind/:id')
  async get(
    @Req() req: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.users.assertAdmin(req.auth.clerkUserId);
    if (!['works', 'authors', 'editions'].includes(kind))
      throw new BadRequestException('Invalid record type');
    return catalogEditorialRequest({ operation: 'get', kind, id });
  }
  @Post(':kind/:id')
  async save(
    @Req() req: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.users.assertAdmin(req.auth.clerkUserId);
    if (!['works', 'authors', 'editions'].includes(kind))
      throw new BadRequestException('Invalid record type');
    return catalogEditorialRequest({
      operation: 'save',
      kind,
      id,
      revision: body.revision,
      data: body.data,
    });
  }
  @Post('works/:id/delete')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.users.assertAdmin(req.auth.clerkUserId);
    if (!Number.isInteger(body.revision))
      throw new BadRequestException('Missing book revision');
    return deleteCatalogWork(this.prisma, id, Number(body.revision));
  }
}
