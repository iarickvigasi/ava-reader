import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import { stubModel } from '../../book-analysis/chapter-purpose/model.fixture';
import { translationContext } from '../testing/translation.fixture';
import type { SentenceAlignment } from '../types';
import { echoedOutput } from './alignment-test-output';

export function fixture(count = 1) {
  const context = translationContext();
  const rows = context.units.slice(0, count).map((unit, index) => ({
    id: index ? `row-${index}` : 'row',
    sentenceId: unit.id,
    sourceText: unit.text,
    translatedText: 'Bonjour lecteur.',
    alignment: null as SentenceAlignment | null,
  }));
  const row = rows[0];
  const findUnique = jest.fn().mockImplementation(() => ({ sentences: rows }));
  const updateMany = jest
    .fn()
    .mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: { alignment: SentenceAlignment };
      }) => {
        rows.find((row) => row.id === where.id)!.alignment = data.alignment;
        return Promise.resolve({ count: 1 });
      },
    );
  const getModel = jest.fn();
  return {
    model: (response: { sentences: Parameters<typeof echoedOutput>[0][] }) =>
      stubModel({
        sentences: response.sentences.map((output) => {
          const match = rows.find((row) => row.sentenceId === output.id) ?? row;
          return echoedOutput(output, match.sourceText, match.translatedText);
        }),
      }),
    row,
    rows,
    getModel,
    updateMany,
    args: {
      prisma: {
        bookTranslation: { findUnique },
        sentenceTranslation: { updateMany },
        $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
      } as unknown as PrismaService,
      openrouter: { getModel } as unknown as OpenRouterClient,
      context,
      sentences: context.units.slice(0, count),
      signal: new AbortController().signal,
    },
  };
}
