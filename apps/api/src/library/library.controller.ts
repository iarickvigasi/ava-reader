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

  // Public read endpoint. Covers are not sensitive (often marketing artwork),
  // bookIds are unpredictable CUIDs, and skipping auth lets `<img>` tags load
  // without juggling Clerk tokens. The long-lived Cache-Control header lets
  // the browser skip repeat downloads as the user scrolls a collection.
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

  // Returns only the fields the book-info screen needs ON TOP of the card
  // data callers already have. Must be registered before the catch-all
  // `:libraryItemId` route below so Nest's path-order matching picks it.
  @Get(':libraryItemId/details')
  @UseGuards(ClerkAuthGuard)
  getLibraryItemDetails(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
  ) {
    return this.libraryService.getLibraryItemDetails(
      request.auth.clerkUserId,
      libraryItemId,
    );
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

  @Post('import')
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  importBook(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.libraryService.importBook(request.auth.clerkUserId, file);
  }
}
