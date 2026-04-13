import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
