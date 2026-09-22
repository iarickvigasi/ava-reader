import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OpenRouterClient } from '../shared/openrouter-client';
import type { GenerateTranslationRequest } from './dto';
import { generateTranslations } from './generation/generate-translations';
import { loadTranslationContext } from './source/load-context';
import { readTranslations } from './storage/read-translations';
import { selectTranslationSentences } from './source/select-sentences';
import { TranslationLock } from './generation/translation-lock';
import type { ChapterTranslation, TranslationResult } from './types';
import {
  translationResponseIdentity,
  translationVersionIdentity,
} from './version-identity';

type ChapterRequest = {
  clerkUserId: string;
  libraryItemId: string;
  chapterId: string;
  targetLang: string;
};

@Injectable()
export class BookTranslationsService {
  private readonly lock = new TranslationLock();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async chapter(request: ChapterRequest): Promise<ChapterTranslation> {
    const context = await loadTranslationContext({
      ...request,
      prisma: this.prisma,
      users: this.users,
    });
    const translations = await readTranslations({
      prisma: this.prisma,
      context,
    });
    return {
      ...translationResponseIdentity(context),
      units: context.units,
      translations,
    };
  }

  async generate(
    request: GenerateTranslationRequest & {
      clerkUserId: string;
      libraryItemId: string;
      signal: AbortSignal;
    },
  ): Promise<TranslationResult> {
    const context = await loadTranslationContext({
      ...request,
      prisma: this.prisma,
      users: this.users,
    });
    const sentences = selectTranslationSentences(context, request);
    const key = JSON.stringify(translationVersionIdentity(context));
    const translations = await this.lock.run(key, request.signal, () =>
      generateTranslations({
        prisma: this.prisma,
        openrouter: this.openrouter,
        context,
        sentences,
        signal: request.signal,
      }),
    );
    return { ...translationResponseIdentity(context), translations };
  }
}
