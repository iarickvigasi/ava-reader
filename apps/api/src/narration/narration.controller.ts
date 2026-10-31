import { identifyNarrationLanguage } from './language/identify-narration-language';
import { translatedNarrationLanguage } from './language/translated-narration-language';
import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { requireOwnedLibraryItem } from '../shared/owned-library-item';
import { parseBody } from '../ai-comments/parse-body';
import { synthesizeSpeech } from './synthesize-speech';

export const narrationSchema = z
  .object({
    text: z.string().trim().min(1).max(2048),
    context: z.string().max(8192).optional(),
    contextOffset: z.number().int().min(0).max(8192).optional(),
    languageHint: z.string().max(128).optional(),
    translationLanguage: z.string().max(128).optional(),
  })
  .refine(
    (input) =>
      input.contextOffset === undefined ||
      input.context?.slice(
        input.contextOffset,
        input.contextOffset + input.text.length,
      ) === input.text,
    {
      message: 'contextOffset must identify the exact selected text.',
      path: ['contextOffset'],
    },
  );

@Controller('library/:libraryItemId/narration')
@UseGuards(ClerkAuthGuard)
export class NarrationController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Post()
  async narrate(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: unknown,
    @Res() response: Response,
  ) {
    const input = parseBody(narrationSchema, body);
    await requireOwnedLibraryItem({
      clerkUserId: request.auth.clerkUserId,
      libraryItemId,
      prisma: this.prisma,
      users: this.users,
    });
    const language =
      translatedNarrationLanguage(input) ??
      (await identifyNarrationLanguage(
        this.config,
        input,
        request.auth.clerkUserId,
      ));
    if (response.destroyed) return;
    const audio = await synthesizeSpeech(
      this.config,
      input.text,
      language,
      input.context,
      input.contextOffset,
    );
    response.set({
      'Content-Type': 'audio/wav',
      'Cache-Control': 'private, no-store',
    });
    response.send(audio);
  }
}
