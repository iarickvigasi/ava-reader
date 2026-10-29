import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { saveCatalogLink } from './save-catalog-link';
@Controller('library/:id/catalog-link')
@UseGuards(ClerkAuthGuard)
export class CatalogLinkController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get()
  async get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = await this.users.getCurrentUserRecord(req.auth.clerkUserId);
    const item = await this.prisma.libraryItem.findFirst({
      where: {
        id,
        userId: user.id,
        source: 'IMPORTED',
        book: { visibility: 'PRIVATE', privateOwnerId: user.id },
      },
      select: { catalogLink: true, catalogLinkVersion: true },
    });
    if (!item) throw new NotFoundException('Private upload not found');
    return { link: item.catalogLink, version: item.catalogLinkVersion };
  }
  @Post()
  async save(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Parameters<typeof saveCatalogLink>[3],
  ) {
    const user = await this.users.getCurrentUserRecord(req.auth.clerkUserId);
    return saveCatalogLink(this.prisma, user.id, id, body);
  }
}
