import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import { stubModel } from '../../book-analysis/chapter-purpose/model.fixture';
import { translationContext } from '../testing/translation.fixture';
import type { SentenceAlignment } from '../types';
import { generateAlignments, readAlignments } from './sentence-alignments';

function fixture() {
  const context = translationContext();
  const unit = context.units[0];
  const row = {
    id: 'row',
    sentenceId: unit.id,
    sourceText: unit.text,
    translatedText: 'Bonjour lecteur.',
    alignment: null as SentenceAlignment | null,
  };
  const findUnique = jest.fn().mockImplementation(() => ({ sentences: [row] }));
  const updateMany = jest
    .fn()
    .mockImplementation(
      ({ data }: { data: { alignment: SentenceAlignment } }) => {
        row.alignment = data.alignment;
        return Promise.resolve({ count: 1 });
      },
    );
  const getModel = jest.fn();
  return {
    row,
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
      sentences: [unit],
      signal: new AbortController().signal,
    },
  };
}

describe('saved sentence alignment', () => {
  it('generates against persisted text and reuses a current map without model work', async () => {
    const f = fixture();
    const { model } = stubModel({
      sentences: [
        { id: f.row.sentenceId, groups: [{ source: [0], translation: [0] }] },
      ],
    });
    f.getModel.mockReturnValue(model);
    const result = await generateAlignments(f.args);
    expect(result[f.row.sentenceId].translatedText).toBe('Bonjour lecteur.');
    expect(f.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'row',
          sourceText: f.row.sourceText,
          translatedText: f.row.translatedText,
        },
      }),
    );
    await generateAlignments(f.args);
    expect(f.getModel).toHaveBeenCalledTimes(1);
    f.row.translatedText = 'Revised translation.';
    expect(await readAlignments(f.args)).toEqual({});
  });

  it('does not persist invented token IDs or mismatched sentence IDs', async () => {
    for (const invalid of [
      { id: 'unknown', groups: [] },
      {
        id: translationContext().units[0].id,
        groups: [{ source: [999], translation: [0] }],
      },
    ]) {
      const f = fixture();
      f.getModel.mockReturnValue(stubModel({ sentences: [invalid] }).model);
      await expect(generateAlignments(f.args)).rejects.toThrow(
        'Phrase matching',
      );
      expect(f.updateMany).not.toHaveBeenCalled();
    }
  });

  it('does not invoke the model after cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateAlignments({ ...f.args, signal: controller.signal }),
    ).rejects.toThrow();
    expect(f.getModel).not.toHaveBeenCalled();
  });
});
