import { etymologySchema, explainSchema, translateSchema } from './dto';

const CONTEXT_FIELDS = {
  context: 'Darcy walked off. Elizabeth remained.',
  bookTitle: 'Pride and Prejudice',
  author: 'Jane Austen',
};

describe('ai-comments DTOs', () => {
  it('translate accepts the selection context fields', () => {
    const parsed = translateSchema.parse({
      text: 'cordial',
      targetLang: 'French',
      ...CONTEXT_FIELDS,
    });

    expect(parsed).toMatchObject(CONTEXT_FIELDS);
  });

  it('etymology accepts the selection context fields', () => {
    const parsed = etymologySchema.parse({
      text: 'cordial',
      ...CONTEXT_FIELDS,
    });

    expect(parsed).toMatchObject(CONTEXT_FIELDS);
  });

  it('explain still accepts the selection context fields', () => {
    const parsed = explainSchema.parse({
      text: 'cordial',
      ...CONTEXT_FIELDS,
    });

    expect(parsed).toMatchObject(CONTEXT_FIELDS);
  });

  it('rejects an oversized context', () => {
    const result = translateSchema.safeParse({
      text: 'cordial',
      targetLang: 'French',
      context: 'x'.repeat(8193),
    });

    expect(result.success).toBe(false);
  });
});
