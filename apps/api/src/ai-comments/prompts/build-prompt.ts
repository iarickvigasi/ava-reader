import { BadRequestException } from '@nestjs/common';
import { AiCommentKind } from '@prisma/client';
import { buildEtymologyPrompt } from './etymology';
import { buildExplainPrompt } from './explain';
import { buildTranslatePrompt } from './translate';

type PromptInput = {
  text: string;
  targetLang?: string;
  context?: string;
  bookTitle?: string;
  author?: string;
};

// Dispatches to the per-tool prompt builder. The only per-kind requirement
// beyond the shared fields is translate's targetLang.
export function buildPromptForKind(
  kind: AiCommentKind,
  input: PromptInput,
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
        context: input.context,
        bookTitle: input.bookTitle,
        author: input.author,
      });
    case AiCommentKind.ETYMOLOGY:
      return buildEtymologyPrompt({
        text: input.text,
        context: input.context,
        bookTitle: input.bookTitle,
        author: input.author,
      });
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
