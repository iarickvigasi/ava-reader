import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { AnnotationsService } from './annotations.service';
import { annotationIdSchema, upsertAnnotationSchema } from './dto';

@Controller('library/:libraryItemId/annotations')
export class AnnotationsController {
  constructor(private readonly service: AnnotationsService) {}

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

  // Idempotent upsert keyed by the client-generated id in the URL. The
  // offline queue replays the same call until it gets a 2xx, so this must
  // succeed even when the row already exists (whether from a previous
  // successful write whose response was lost, or from a color-change retry).
  @Put(':id')
  @UseGuards(ClerkAuthGuard)
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsedId = parseId(id);
    const parsed = parseBody(upsertAnnotationSchema, body);
    const item = await this.service.upsert({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      id: parsedId,
      excerpt: parsed.excerpt,
      highlightColor: parsed.highlightColor,
      locator: parsed.locator ?? null,
    });
    return { item };
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Param('id') id: string,
  ) {
    const parsedId = parseId(id);
    await this.service.remove({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      id: parsedId,
    });
  }
}

function parseId(value: string): string {
  try {
    return annotationIdSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException('Annotation id is invalid.');
    }
    throw error;
  }
}

function parseBody<T>(
  schema: { parse: (input: unknown) => T },
  body: unknown,
): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(
        error.issues.map((issue) => issue.message).join(', '),
      );
    }
    throw error;
  }
}
