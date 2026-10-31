import { AiCommentKind } from '@prisma/client';
import { buildPromptForKind } from './build-prompt';
it.each([AiCommentKind.EXPLAIN, AiCommentKind.ETYMOLOGY])(
  'writes %s in the selected response language',
  (kind) => {
    const result = buildPromptForKind(kind, {
      text: 'cordial',
      targetLang: 'Ukrainian',
    });
    expect(result.system).toContain('entire response in Ukrainian');
  },
);
