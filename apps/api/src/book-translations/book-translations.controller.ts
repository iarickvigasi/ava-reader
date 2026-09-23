import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { parseBody } from '../ai-comments/parse-body';
import { BookTranslationsService } from './book-translations.service';
import { generateTranslationSchema, translationQuerySchema } from './dto';

@Controller('library/:libraryItemId/translations')
@UseGuards(ClerkAuthGuard)
export class BookTranslationsController {
  constructor(private readonly service: BookTranslationsService) {}

  @Get('chapters/:chapterId')
  chapter(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Param('chapterId') chapterId: string,
    @Query() query: unknown,
  ) {
    return this.service.chapter({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      chapterId,
      ...parseBody(translationQuerySchema, query),
    });
  }

  @Post('generate')
  @HttpCode(200)
  async generate(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(generateTranslationSchema, body);
    const controller = new AbortController();
    const abort = () => {
      if (!response.writableEnded) controller.abort();
    };
    request.once('aborted', abort);
    response.once('close', abort);
    try {
      return await this.service.generate({
        ...parsed,
        clerkUserId: request.auth.clerkUserId,
        libraryItemId,
        signal: controller.signal,
      });
    } finally {
      request.off('aborted', abort);
      response.off('close', abort);
    }
  }

  @Post('align')
  @HttpCode(200)
  async align(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(generateTranslationSchema, body);
    const controller = new AbortController();
    const abort = () => {
      if (!response.writableEnded) controller.abort();
    };
    request.once('aborted', abort);
    response.once('close', abort);
    try {
      return await this.service.align({
        ...parsed,
        clerkUserId: request.auth.clerkUserId,
        libraryItemId,
        signal: controller.signal,
      });
    } finally {
      request.off('aborted', abort);
      response.off('close', abort);
    }
  }
}
