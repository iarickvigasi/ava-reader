import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { AiCommentsService } from './ai-comments.service';

// Reads and deletes of persisted AI comments (spec 4-ai-comments). The tool
// runs that create them live in AiToolboxController on the same prefix.
@Controller('library/:libraryItemId/ai-comments')
export class AiCommentsController {
  constructor(private readonly service: AiCommentsService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
  ) {
    const items = await this.service.list(
      request.auth.clerkUserId,
      libraryItemId,
    );
    return { items };
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Param('id') id: string,
  ) {
    await this.service.remove({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      id,
    });
  }
}
