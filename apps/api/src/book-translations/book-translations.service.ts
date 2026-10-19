import { assertCanonicalTranslationAuthority } from './source/assert-canonical-authority';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OpenRouterClient } from '../shared/openrouter-client';
import type {
  ChapterTranslationRequest,
  GenerateChapterTranslationRequest,
} from './requests';
import { generateTranslations } from './generation/generate-translations';
import { loadTranslationContext } from './source/load-context';
import { readTranslations } from './storage/read-translations';
import { selectTranslationSentences } from './source/select-sentences';
import { TranslationLock } from './generation/translation-lock';
import {
  generateAlignments,
  readAlignments,
} from './alignment/sentence-alignments';
import type { ChapterTranslation, TranslationResult } from './types';
import {
  translationResponseIdentity,
  translationVersionIdentity,
} from './version-identity';

@Injectable()
export class BookTranslationsService {
  private readonly lock = new TranslationLock();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async chapter(
    request: ChapterTranslationRequest,
  ): Promise<ChapterTranslation> {
    const context = await loadTranslationContext({
      ...request,
      prisma: this.prisma,
      users: this.users,
    });
    const translations = await readTranslations({
      prisma: this.prisma,
      context,
    });
    const alignments = await readAlignments({ prisma: this.prisma, context });
    await assertCanonicalTranslationAuthority(this.prisma, context);
    return {
      ...translationResponseIdentity(context),
      units: context.units,
      translations,
      alignments,
    };
  }

  async generate(
    request: GenerateChapterTranslationRequest,
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
        regenerate: request.regenerate,
      }),
    );
    await assertCanonicalTranslationAuthority(this.prisma, context);
    return { ...translationResponseIdentity(context), translations };
  }

  async align(request: GenerateChapterTranslationRequest) {
    const context = await loadTranslationContext({
      ...request,
      prisma: this.prisma,
      users: this.users,
    });
    const sentences = selectTranslationSentences(context, request);
    const key = `alignment:${JSON.stringify(translationVersionIdentity(context))}`;
    const alignments = await this.lock.run(key, request.signal, () =>
      generateAlignments({
        prisma: this.prisma,
        openrouter: this.openrouter,
        context,
        sentences,
        signal: request.signal,
        regenerate: request.regenerate,
      }),
    );
    await assertCanonicalTranslationAuthority(this.prisma, context);
    return { ...translationResponseIdentity(context), alignments };
  }
}
