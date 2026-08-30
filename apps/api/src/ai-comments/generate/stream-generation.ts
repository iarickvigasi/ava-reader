import { streamObject } from 'ai';
import type { z } from 'zod';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import type {
  AiToolGenerationResult,
  GenerateInput,
} from '../ai-comment-types';
import { getOutputSpec } from '../output-schemas';
import { buildPromptForKind } from '../prompts';
import { persistGeneratedComment } from './persist-generated-comment';

// Starts the structured-output stream and wires persistence to its
// completion. Returns as soon as the stream exists — the controller does the
// consuming, and the upsert happens later in `onFinish`.
export function streamAiComment(args: {
  libraryItemId: string;
  modelId: string;
  normalizedText: string;
  openrouter: OpenRouterClient;
  prisma: PrismaService;
  request: GenerateInput;
  sourceHash: string;
  userId: string;
}): AiToolGenerationResult {
  const promptParts = buildPromptForKind(args.request.kind, {
    text: args.normalizedText,
    targetLang: args.request.targetLang,
    context: args.request.context,
    bookTitle: args.request.bookTitle,
    author: args.request.author,
  });
  const { schema, fieldKey } = getOutputSpec(args.request.kind);

  // The schema is a per-tool union here; widen to a generic record schema
  // for the streamObject overload. The runtime shape is still validated by
  // Zod — only the static type is loosened.
  const widenedSchema = schema as unknown as z.ZodType<Record<string, unknown>>;
  const result = streamObject({
    model: args.openrouter.getModel(),
    schema: widenedSchema,
    system: promptParts.system,
    prompt: promptParts.prompt,
    onFinish: (event) =>
      persistGeneratedComment({
        fieldKey,
        finalObject: event.object,
        libraryItemId: args.libraryItemId,
        modelId: args.modelId,
        normalizedText: args.normalizedText,
        prisma: args.prisma,
        request: args.request,
        sourceHash: args.sourceHash,
        userId: args.userId,
      }),
  });

  return { kind: 'stream', result, fieldKey, modelId: args.modelId };
}
