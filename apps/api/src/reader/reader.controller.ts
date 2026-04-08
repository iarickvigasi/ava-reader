import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ReaderService } from './reader.service';
import type { ReaderLocator } from './reader-types';

@Controller('library/:libraryItemId/reader')
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  getReader(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Query('chapter') chapter?: string,
  ) {
    return this.readerService.getReaderPayload(
      request.auth.clerkUserId,
      libraryItemId,
      chapter,
    );
  }

  @Patch('progress')
  @UseGuards(ClerkAuthGuard)
  updateProgress(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: { locator?: ReaderLocator },
  ) {
    return this.readerService.updateProgress(
      request.auth.clerkUserId,
      libraryItemId,
      body.locator as ReaderLocator,
    );
  }
}
