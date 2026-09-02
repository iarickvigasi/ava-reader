import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AiCommentKind } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { AiCommentsService } from './ai-comments.service';
import { etymologySchema, explainSchema, translateSchema } from './dto';
import { sendStreamingResponse } from './generate/stream-to-response';
import { parseBody } from './parse-body';

// The three on-selection tools (spec 5.2-ai-toolbox). Each streams its answer
// back as plain text; the AI comment it leaves behind is read and deleted
// through AiCommentsController, which shares this route prefix.
@Controller('library/:libraryItemId/ai-comments')
export class AiToolboxController {
  constructor(private readonly service: AiCommentsService) {}

  @Post('translate')
  @UseGuards(ClerkAuthGuard)
  async translate(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(translateSchema, body);
    const result = await this.service.generate({
      ...parsed,
      clerkUserId: request.auth.clerkUserId,
      kind: AiCommentKind.TRANSLATE,
      libraryItemId,
    });
    await sendStreamingResponse(response, result);
  }

  @Post('etymology')
  @UseGuards(ClerkAuthGuard)
  async etymology(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(etymologySchema, body);
    const result = await this.service.generate({
      ...parsed,
      clerkUserId: request.auth.clerkUserId,
      kind: AiCommentKind.ETYMOLOGY,
      libraryItemId,
    });
    await sendStreamingResponse(response, result);
  }

  @Post('explain')
  @UseGuards(ClerkAuthGuard)
  async explain(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
  ) {
    const parsed = parseBody(explainSchema, body);
    const result = await this.service.generate({
      ...parsed,
      clerkUserId: request.auth.clerkUserId,
      kind: AiCommentKind.EXPLAIN,
      libraryItemId,
    });
    await sendStreamingResponse(response, result);
  }
}
