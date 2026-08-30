import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { GenerateInput } from '../ai-comment-types';
import type { AiToolOutputField } from '../output-schemas';

const logger = new Logger('persistGeneratedComment');

// Persists the final field text after the model finishes streaming.
// Failures here must not crash the response (the user has already seen the
// text), so we log and swallow.
export async function persistGeneratedComment(args: {
  finalObject: Record<string, unknown> | undefined;
  fieldKey: AiToolOutputField;
  libraryItemId: string;
  modelId: string;
  normalizedText: string;
  prisma: PrismaService;
  request: GenerateInput;
  sourceHash: string;
  userId: string;
}): Promise<void> {
  const value = args.finalObject?.[args.fieldKey];
  const body = typeof value === 'string' ? value.trim() : '';
  if (!body) {
    return;
  }
  try {
    await args.prisma.aiComment.upsert({
      where: {
        userId_sourceHash: {
          userId: args.userId,
          sourceHash: args.sourceHash,
        },
      },
      create: {
        userId: args.userId,
        libraryItemId: args.libraryItemId,
        kind: args.request.kind,
        sourceText: args.normalizedText,
        sourceHash: args.sourceHash,
        targetLang: args.request.targetLang ?? null,
        model: args.modelId,
        body,
        locator: args.request.locator ?? null,
      },
      update: {
        body,
        locator: args.request.locator ?? null,
      },
    });
  } catch (error: unknown) {
    logger.error(
      `Failed to persist generated body (kind=${args.request.kind})`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
