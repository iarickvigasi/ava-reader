import type { AiCommentKind } from '@prisma/client';
import type { StreamObjectResult } from 'ai';
import type { AiToolOutputField } from './output-schemas';

// All three tools route through `generate`. The caller sets `kind` and
// supplies the per-tool optional inputs. The service handles ownership,
// normalization, cache lookup, and persistence — the controller only worries
// about HTTP framing.
export type GenerateInput = {
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

// Shape returned by `list()` — the only difference from the raw Prisma row is
// that we hand back the locator as a parsed object (or null) so the client
// doesn't need to JSON.parse it. Anything that fails to parse is dropped to
// null instead of erroring the whole list.
export type AiCommentListItem = {
  id: string;
  kind: AiCommentKind;
  sourceText: string;
  body: string;
  targetLang: string | null;
  locator: unknown;
  createdAt: Date;
};
