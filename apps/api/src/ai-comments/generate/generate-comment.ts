import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import type {
  AiToolGenerationResult,
  GenerateInput,
} from '../ai-comment-types';
import { buildSourceHash, normalizeSelectionText } from '../source-hash';
import { findCachedAiComment } from './find-cached-comment';
import { streamAiComment } from './stream-generation';

export async function generateAiComment(args: {
  libraryItemId: string;
  openrouter: OpenRouterClient;
  prisma: PrismaService;
  request: GenerateInput;
  userId: string;
}): Promise<AiToolGenerationResult> {
  const { request } = args;
  const normalizedText = normalizeSelectionText(request.text);
  if (normalizedText.length === 0) {
    throw new BadRequestException(
      'No selection text provided after normalization.',
    );
  }

  const modelId = args.openrouter.getModelId();
  const sourceHash = buildSourceHash({
    kind: request.kind,
    text: normalizedText,
    targetLang: request.targetLang ?? null,
    model: modelId,
    context: request.context ?? null,
    bookTitle: request.bookTitle ?? null,
    author: request.author ?? null,
  });

  const cached = await findCachedAiComment({
    prisma: args.prisma,
    sourceHash,
    userId: args.userId,
  });
  if (cached) {
    return { kind: 'cached', body: cached.body, modelId };
  }

  return streamAiComment({ ...args, modelId, normalizedText, sourceHash });
}
