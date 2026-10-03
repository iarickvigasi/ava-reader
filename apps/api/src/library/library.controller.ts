import { withUploadedFilename } from '../shared/uploaded-filename';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { LibraryService } from './library.service';
import { sendOwnedBlob } from './pdf-import/artifacts/send-owned-blob';

@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  getLibrary(@Req() request: AuthenticatedRequest) {
    return this.libraryService.getLibrary(request.auth.clerkUserId);
  }

  @Get('collections/:collectionId')
  @UseGuards(ClerkAuthGuard)
  getCollection(
    @Req() request: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    return this.libraryService.getCollection(
      request.auth.clerkUserId,
      collectionId,
    );
  }

  // Legacy cover route. PDF-import books are explicitly denied by the service;
  // their covers require the owned route. Broader legacy EPUB cover delivery
  // remains a separate authenticated-client migration.
  @Get('covers/:bookId')
  async getBookCover(
    @Param('bookId') bookId: string,
    @Res() response: Response,
  ) {
    const cover = await this.libraryService.getBookCover(bookId);
    if (!cover) {
      throw new NotFoundException('Cover not found.');
    }
    response.setHeader('Content-Type', cover.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    response.send(Buffer.from(cover.bytes));
  }

  @Get(':libraryItemId')
  @UseGuards(ClerkAuthGuard)
  getLibraryItem(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
  ) {
    return this.libraryService.getLibraryItem(
      request.auth.clerkUserId,
      libraryItemId,
    );
  }

  @Patch(':libraryItemId/offline')
  @UseGuards(ClerkAuthGuard)
  setOfflineRequested(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: { requested: boolean },
  ) {
    return this.libraryService.setOfflineRequested(
      request.auth.clerkUserId,
      libraryItemId,
      body.requested,
    );
  }

  @Get(':libraryItemId/formats/:format')
  @UseGuards(ClerkAuthGuard)
  async downloadFormat(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') ref: string,
    @Param('format') format: string,
    @Res() response: Response,
  ) {
    sendOwnedBlob(
      response,
      await this.libraryService.getLibraryFormat(
        request.auth.clerkUserId,
        ref,
        format,
      ),
    );
  }

  @Patch(':libraryItemId/finished')
  @UseGuards(ClerkAuthGuard)
  setFinishedAt(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    return this.libraryService.setFinishedAt(
      request.auth.clerkUserId,
      libraryItemId,
      body,
    );
  }

  @Post('collections')
  @UseGuards(ClerkAuthGuard)
  createCollection(
    @Req() request: AuthenticatedRequest,
    @Body() body: { name?: unknown; description?: unknown },
  ) {
    return this.libraryService.createCollection(request.auth.clerkUserId, body);
  }

  @Patch('collections/:collectionId')
  @UseGuards(ClerkAuthGuard)
  renameCollection(
    @Req() request: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
    @Body() body: { description?: null | string; name?: string },
  ) {
    return this.libraryService.renameCollection(
      request.auth.clerkUserId,
      collectionId,
      {
        description: body.description,
        name: body.name,
      },
    );
  }

  @Delete('collections/:collectionId')
  @UseGuards(ClerkAuthGuard)
  deleteCollection(
    @Req() request: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    return this.libraryService.deleteCollection(
      request.auth.clerkUserId,
      collectionId,
    );
  }

  @Delete(':libraryItemId')
  @UseGuards(ClerkAuthGuard)
  deleteLibraryItem(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') id: string,
  ) {
    return this.libraryService.deleteLibraryItem(request.auth.clerkUserId, id);
  }

  @Post('import')
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  importBook(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { originalFilename?: unknown } = {},
  ) {
    return this.libraryService.importBook(
      request.auth.clerkUserId,
      withUploadedFilename(file, body.originalFilename),
    );
  }
}
