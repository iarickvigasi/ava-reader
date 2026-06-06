import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

  @Post('open')
  @UseGuards(ClerkAuthGuard)
  markReaderOpened(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
  ) {
    return this.readerService.markReaderOpened(
      request.auth.clerkUserId,
      libraryItemId,
    );
  }

  @Post('session')
  @UseGuards(ClerkAuthGuard)
  startSession(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body()
    body: {
      clientInstanceId?: string;
      // Phase 4 (offline-first): stable client-generated session id. When
      // supplied the server upserts by (userId, clientSessionId). When
      // startedAt/endedAt are supplied, the server treats this as a
      // completed-session replay from the offline queue and records those
      // exact timestamps instead of "now."
      clientSessionId?: string;
      startedAt?: string;
      endedAt?: string;
    },
  ) {
    return this.readerService.startSession(
      request.auth.clerkUserId,
      libraryItemId,
      body.clientInstanceId as string,
      {
        clientSessionId: body.clientSessionId ?? null,
        startedAt: body.startedAt ?? null,
        endedAt: body.endedAt ?? null,
      },
    );
  }

  @Patch('session')
  @UseGuards(ClerkAuthGuard)
  heartbeatSession(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: { clientInstanceId?: string; sessionId?: string },
  ) {
    return this.readerService.heartbeatSession(
      request.auth.clerkUserId,
      libraryItemId,
      body.sessionId as string,
      body.clientInstanceId as string,
    );
  }

  @Post('session/stop')
  @UseGuards(ClerkAuthGuard)
  stopSession(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: { clientInstanceId?: string; sessionId?: string },
  ) {
    return this.readerService.stopSession(
      request.auth.clerkUserId,
      libraryItemId,
      body.sessionId as string,
      body.clientInstanceId as string,
    );
  }
}
