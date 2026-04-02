import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('admin/catalog')
  @UseGuards(ClerkAuthGuard)
  listAdminCatalog(@Req() request: AuthenticatedRequest) {
    return this.catalogService.listAdminCatalog(request.auth.clerkUserId);
  }

  @Post('admin/catalog')
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'sourceFile', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  createCatalogEntry(
    @Req() request: AuthenticatedRequest,
    @UploadedFiles()
    files: {
      coverImage?: Express.Multer.File[];
      sourceFile?: Express.Multer.File[];
    },
  ) {
    return this.catalogService.createCatalogEntry(
      request.auth.clerkUserId,
      request.body as Record<string, unknown>,
      files,
    );
  }

  @Patch('admin/catalog/:entryId')
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'sourceFile', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 },
    ]),
  )
  updateCatalogEntry(
    @Req() request: AuthenticatedRequest,
    @Param('entryId') entryId: string,
    @UploadedFiles()
    files: {
      coverImage?: Express.Multer.File[];
      sourceFile?: Express.Multer.File[];
    },
  ) {
    return this.catalogService.updateCatalogEntry(
      request.auth.clerkUserId,
      entryId,
      request.body as Record<string, unknown>,
      files,
    );
  }

  @Post('catalog/:entryId/add-to-library')
  @UseGuards(ClerkAuthGuard)
  addToLibrary(
    @Req() request: AuthenticatedRequest,
    @Param('entryId') entryId: string,
  ) {
    return this.catalogService.addCatalogBookToLibrary(
      request.auth.clerkUserId,
      entryId,
    );
  }
}
