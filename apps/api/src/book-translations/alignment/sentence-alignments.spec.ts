import type { PrismaService } from '../../prisma/prisma.service';
import type { OpenRouterClient } from '../../shared/openrouter-client';
import { stubModel } from '../../book-analysis/chapter-purpose/model.fixture';
import { translationContext } from '../testing/translation.fixture';
import type { SentenceAlignment } from '../types';
import { generateAlignments, readAlignments } from './sentence-alignments';

function fixture(count = 1) {
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
      expect(await generateAlignments(f.args)).toEqual({});
      expect(f.getModel).toHaveBeenCalledTimes(3);
      expect(f.updateMany).not.toHaveBeenCalled();
    }
  });

  it('saves good sentences and retries only the invalid sentence with feedback', async () => {
    const f = fixture(2);
    const good = {
      id: f.rows[0].sentenceId,
      groups: [{ source: [0], translation: [0] }],
    };
    const bad = {
      id: f.rows[1].sentenceId,
      groups: [{ source: [999], translation: [0] }],
    };
    const repair = stubModel({ sentences: [{ ...bad, groups: good.groups }] });
    f.getModel
      .mockReturnValueOnce(stubModel({ sentences: [good, bad] }).model)
      .mockImplementation(() => {
        expect(f.rows[0].alignment).not.toBeNull();
        return repair.model;
      });
    const result = await generateAlignments(f.args);
    expect(Object.keys(result)).toHaveLength(2);
    expect(f.getModel).toHaveBeenCalledTimes(2);
    expect(repair.prompts[0]).toContain('Invalid source token ID 999');
    expect(repair.prompts[0]).not.toContain(f.rows[0].sentenceId);
  });

  it('returns saved sentences after the invalid sentence exhausts two retries', async () => {
    const f = fixture(2);
    const good = {
      id: f.rows[0].sentenceId,
      groups: [{ source: [0], translation: [0] }],
    };
    const bad = {
      id: f.rows[1].sentenceId,
      groups: [{ source: [999], translation: [0] }],
    };
    f.getModel
      .mockReturnValueOnce(stubModel({ sentences: [good, bad] }).model)
      .mockReturnValue(stubModel({ sentences: [bad] }).model);
    const result = await generateAlignments(f.args);
    expect(Object.keys(result)).toEqual([good.id]);
    expect(f.getModel).toHaveBeenCalledTimes(3);
    expect(f.updateMany).toHaveBeenCalledTimes(1);
  });

  it('stops retries and does not save a repair after cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    const invalid = {
      id: f.row.sentenceId,
      groups: [{ source: [999], translation: [0] }],
    };
    f.getModel
      .mockReturnValueOnce(stubModel({ sentences: [invalid] }).model)
      .mockImplementation(() => {
        controller.abort();
        return stubModel({ sentences: [{ ...invalid, groups: [] }] }).model;
      });
    await expect(
      generateAlignments({ ...f.args, signal: controller.signal }),
    ).rejects.toThrow();
    expect(f.updateMany).not.toHaveBeenCalled();
    expect(f.getModel).toHaveBeenCalledTimes(2);
  });

  it('regenerates legacy broad alignments without changing the translation', async () => {
    const f = fixture();
    f.row.alignment = {
      version: 1,
      sourceText: f.row.sourceText,
      translatedText: f.row.translatedText,
      groups: [],
    } as unknown as SentenceAlignment;
    expect(await readAlignments(f.args)).toEqual({});
    f.getModel.mockReturnValue(
      stubModel({
        sentences: [
          { id: f.row.sentenceId, groups: [{ source: [0], translation: [0] }] },
        ],
      }).model,
    );
    const result = await generateAlignments(f.args);
    expect(result[f.row.sentenceId].version).toBe(2);
    expect(result[f.row.sentenceId].translatedText).toBe('Bonjour lecteur.');
    expect(f.getModel).toHaveBeenCalledTimes(1);
  });

  it('retries a broad group with word-level refinement feedback', async () => {
    const f = fixture();
    const sourceText = 'zunächst die Fakten über den menschlichen Körper';
    f.row.sourceText = sourceText;
    f.row.translatedText = 'first the facts about the human body';
    f.args.context.units[0].text = sourceText;
    const ids = [0, 1, 2, 3, 4, 5, 6];
    const repair = stubModel({
      sentences: [
        {
          id: f.row.sentenceId,
          groups: ids.map((id) => ({ source: [id], translation: [id] })),
        },
      ],
    });
    f.getModel
      .mockReturnValueOnce(
        stubModel({
          sentences: [
            {
              id: f.row.sentenceId,
              groups: [{ source: ids, translation: ids }],
            },
          ],
        }).model,
      )
      .mockReturnValue(repair.model);
    const result = await generateAlignments(f.args);
    expect(result[f.row.sentenceId].groups).toHaveLength(7);
    expect(repair.prompts[0]).toContain('Overly broad source group');
    expect(f.getModel).toHaveBeenCalledTimes(2);
  });

  it('bypasses a saved alignment when explicitly regenerating', async () => {
    const f = fixture();
    f.row.alignment = {
      version: 2,
      sourceText: f.row.sourceText,
      translatedText: f.row.translatedText,
      groups: [],
    };
    f.getModel.mockReturnValue(
      stubModel({
        sentences: [
          { id: f.row.sentenceId, groups: [{ source: [0], translation: [0] }] },
        ],
      }).model,
    );
    const result = await generateAlignments({ ...f.args, regenerate: true });
    expect(f.getModel).toHaveBeenCalledTimes(1);
    expect(result[f.row.sentenceId].groups).toHaveLength(1);
  });

  it('does not report an old alignment as a successful regeneration', async () => {
    const f = fixture();
    f.row.alignment = {
      version: 2,
      sourceText: f.row.sourceText,
      translatedText: f.row.translatedText,
      groups: [],
    };
    f.getModel.mockReturnValue(stubModel({ sentences: [] }).model);
    expect(await generateAlignments({ ...f.args, regenerate: true })).toEqual(
      {},
    );
    expect(f.updateMany).not.toHaveBeenCalled();
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
