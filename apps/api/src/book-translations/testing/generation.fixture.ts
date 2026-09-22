import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import { stubModel } from '../../book-analysis/chapter-purpose/model.fixture';
import { translationContext } from './translation.fixture';

export function generationFixture() {
  const context = translationContext();
  const stored = new Map<string, string>();
  const createMany = jest.fn(
    (args: { data: { sentenceId: string; translatedText: string }[] }) => {
      args.data.forEach((item) =>
        stored.set(item.sentenceId, item.translatedText),
      );
      return Promise.resolve({ count: args.data.length });
    },
  );
  const upsert = jest.fn().mockResolvedValue({ id: 'version-1' });
  const findUnique = jest.fn(() =>
    Promise.resolve({
      sentences: [...stored].map(([sentenceId, translatedText]) => ({
        sentenceId,
        translatedText,
      })),
    }),
  );
  const tx = {
    bookTranslation: { upsert },
    sentenceTranslation: { createMany },
  };
  const prisma = {
    ...tx,
    bookTranslation: { upsert, findUnique },
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<void>) =>
      callback(tx),
    ),
  };
  const generated = context.units.map((unit) => ({
    id: unit.id,
    text: `French: ${unit.text}`,
  }));
  const { model, prompts } = stubModel({ translations: generated });
  const getModelId = jest.fn(() => 'stub');
  const getModel = jest.fn(() => model);
  const openrouter = { getModelId, getModel } as unknown as OpenRouterClient;
  return {
    context,
    stored,
    createMany,
    upsert,
    findUnique,
    getModelId,
    getModel,
    prompts,
    args: {
      context,
      prisma: prisma as unknown as PrismaService,
      openrouter,
      sentences: context.units,
      signal: new AbortController().signal,
    },
  };
}
