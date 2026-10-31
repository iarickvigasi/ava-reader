import { AiCommentKind } from '@prisma/client';
import { streamObject } from 'ai';
import { generateAiComment } from './generate-comment';
import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';

jest.mock('ai', () => ({ streamObject: jest.fn() }));
const stream = jest.mocked(streamObject);
type CacheLookup = {
  where: { userId_sourceHash: { sourceHash: string; userId: string } };
};
const findUnique = jest
  .fn<Promise<null>, [CacheLookup]>()
  .mockResolvedValue(null);
const prisma = { aiComment: { findUnique } } as unknown as PrismaService;
const openrouter = {
  getModelId: () => 'model',
  getModel: () => ({}),
} as unknown as OpenRouterClient;
beforeEach(() => jest.clearAllMocks());

const generate = (text: string) =>
  generateAiComment({
    prisma,
    openrouter,
    userId: 'reader',
    libraryItemId: 'book',
    request: {
      clerkUserId: 'clerk',
      libraryItemId: 'book',
      kind: AiCommentKind.TRANSLATE,
      text,
      targetLang: 'English',
    },
  });

it.each(['"hello"', '“hello”', "'hello'", '""', '“”'])(
  'preserves the complete quoted same-language selection %s in the actual prompt',
  async (text) => {
    await generate(text);
    const input = stream.mock.calls[0][0] as { prompt: string; system: string };
    expect(input.prompt).toContain(
      `Exact selected text (JSON string, complete literal input):\n${JSON.stringify(text)}`,
    );
    expect(input.system).toContain('return it exactly unchanged');
  },
);

it('does not reuse the unquoted selection cache for quoted literal input', async () => {
  await generate('hello');
  await generate('“hello”');
  const first = findUnique.mock.calls[0][0];
  const second = findUnique.mock.calls[1][0];
  expect(second.where.userId_sourceHash.sourceHash).not.toBe(
    first.where.userId_sourceHash.sourceHash,
  );
});

it('continues to reject a whitespace-only literal selection', async () => {
  await expect(generate('  \n ')).rejects.toMatchObject({ status: 400 });
  expect(stream).not.toHaveBeenCalled();
});
