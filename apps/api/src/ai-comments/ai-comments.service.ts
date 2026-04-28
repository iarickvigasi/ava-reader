import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiCommentKind } from '@prisma/client';
import { streamObject, type StreamObjectResult } from 'ai';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OpenRouterClient } from './openrouter-client';
import { getOutputSpec, type AiToolOutputField } from './output-schemas';
import {
  buildEtymologyPrompt,
  buildExplainPrompt,
  buildTranslatePrompt,
} from './prompts';
import { buildSourceHash, normalizeSelectionText } from './source-hash';

// All three tools route through `generate`. The caller sets `kind` and
// supplies the per-tool optional inputs. The service handles ownership,
// normalization, cache lookup, and persistence — the controller only worries
// about HTTP framing.
type GenerateInput = {
  clerkUserId: string;
  libraryItemId: string;
  kind: AiCommentKind;
  text: string;
  locator?: string;
  targetLang?: string;
  context?: string;
  bookTitle?: string;
  author?: string;
};

export type AiToolGenerationResult =
  | { kind: 'cached'; body: string; modelId: string }
  | {
      kind: 'stream';
      // The structured-object stream. The controller iterates
      // `partialObjectStream`, extracts the `fieldKey`, and emits text deltas
      // to the response — that way the client only ever sees the field's
      // value, never the surrounding JSON envelope. Generics are `any`
      // because each tool has a different concrete schema; the controller
      // narrows by `fieldKey` at the call site.
      result: StreamObjectResult<any, any, any>;
      fieldKey: AiToolOutputField;
      modelId: string;
    };

@Injectable()
export class AiCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async generate(input: GenerateInput): Promise<AiToolGenerationResult> {
    const user = await this.users.getCurrentUserRecord(input.clerkUserId);
    const libraryItem = await this.prisma.libraryItem.findFirst({
      where: { id: input.libraryItemId, userId: user.id },
      select: { id: true },
    });
    if (!libraryItem) {
      throw new NotFoundException('Library item not found.');
    }

    const normalizedText = normalizeSelectionText(input.text);
    if (normalizedText.length === 0) {
      throw new BadRequestException(
        'No selection text provided after normalization.',
      );
    }

    const modelId = this.openrouter.getModelId();
    const sourceHash = buildSourceHash({
      kind: input.kind,
      text: normalizedText,
      targetLang: input.targetLang ?? null,
      model: modelId,
    });

    // Per-user cache: identical selection + tool + targetLang + model means
    // we can skip the model call entirely.
    const cached = await this.prisma.aiComment.findUnique({
      where: { userId_sourceHash: { userId: user.id, sourceHash } },
    });
    if (cached) {
      return { kind: 'cached', body: cached.body, modelId };
    }

    const promptParts = this.buildPrompt(input.kind, {
      text: normalizedText,
      targetLang: input.targetLang,
      context: input.context,
      bookTitle: input.bookTitle,
      author: input.author,
    });
    const { schema, fieldKey } = getOutputSpec(input.kind);

    const model = this.openrouter.getModel();
    // The schema is a per-tool union here; widen to a generic record schema
    // for the streamObject overload. The runtime shape is still validated by
    // Zod — only the static type is loosened.
    const widenedSchema = schema as unknown as z.ZodType<
      Record<string, unknown>
    >;
    const result = streamObject({
      model,
      schema: widenedSchema,
      system: promptParts.system,
      prompt: promptParts.prompt,
      // Persist the final field text after the model finishes streaming.
      // Failures here must not crash the response (the user has already seen
      // the text), so we log and swallow.
      onFinish: async (event) => {
        const finalObject = event.object;
        const body =
          typeof finalObject?.[fieldKey] === 'string'
            ? finalObject[fieldKey].trim()
            : '';
        if (!body) {
          return;
        }
        try {
          await this.prisma.aiComment.upsert({
            where: { userId_sourceHash: { userId: user.id, sourceHash } },
            create: {
              userId: user.id,
              libraryItemId: libraryItem.id,
              kind: input.kind,
              sourceText: normalizedText,
              sourceHash,
              targetLang: input.targetLang ?? null,
              model: modelId,
              body,
              locator: input.locator ?? null,
            },
            update: {
              body,
              locator: input.locator ?? null,
            },
          });
        } catch (error: unknown) {
          // Persisting is a nice-to-have; the user already received the
          // streamed answer. Log and continue.
          console.error('[ai-comments] failed to persist generated body', {
            error,
            kind: input.kind,
          });
        }
      },
    });

    return { kind: 'stream', result, fieldKey, modelId };
  }

  private buildPrompt(
    kind: AiCommentKind,
    input: {
      text: string;
      targetLang?: string;
      context?: string;
      bookTitle?: string;
      author?: string;
    },
  ): { system: string; prompt: string } {
    switch (kind) {
      case AiCommentKind.TRANSLATE:
        if (!input.targetLang) {
          throw new BadRequestException(
            'targetLang is required for the translate tool.',
          );
        }
        return buildTranslatePrompt({
          text: input.text,
          targetLang: input.targetLang,
        });
      case AiCommentKind.ETYMOLOGY:
        return buildEtymologyPrompt({ text: input.text });
      case AiCommentKind.EXPLAIN:
        return buildExplainPrompt({
          text: input.text,
          context: input.context,
          bookTitle: input.bookTitle,
          author: input.author,
        });
      default: {
        // Exhaustiveness guard — `kind` should be `never` here once all enum
        // values are handled. If the enum gains a new variant the compiler
        // will flag this branch.
        const exhaustive: never = kind;
        throw new BadRequestException(
          `Unknown AI tool kind: ${String(exhaustive)}`,
        );
      }
    }
  }
}
