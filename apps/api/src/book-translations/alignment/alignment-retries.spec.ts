import { fixture } from './alignment-test-fixture';
import type { SentenceAlignment } from '../types';
import { generateAlignments, readAlignments } from './sentence-alignments';

describe('saved sentence alignment', () => {
  it('stops retries and does not save a repair after cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    const invalid = {
      id: f.row.sentenceId,
      groups: [{ source: [999], translation: [0] }],
    };
    f.getModel
      .mockReturnValueOnce(f.model({ sentences: [invalid] }).model)
      .mockImplementation(() => {
        controller.abort();
        return f.model({ sentences: [{ ...invalid, groups: [] }] }).model;
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
      version: 2,
      sourceText: f.row.sourceText,
      translatedText: f.row.translatedText,
      groups: [],
    } as unknown as SentenceAlignment;
    expect(await readAlignments(f.args)).toEqual({});
    f.getModel.mockReturnValue(
      f.model({
        sentences: [
          { id: f.row.sentenceId, groups: [{ source: [0], translation: [0] }] },
        ],
      }).model,
    );
    const result = await generateAlignments(f.args);
    expect(result[f.row.sentenceId].version).toBe(3);
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
    const repair = f.model({
      sentences: [
        {
          id: f.row.sentenceId,
          groups: ids.map((id) => ({ source: [id], translation: [id] })),
        },
      ],
    });
    f.getModel
      .mockReturnValueOnce(
        f.model({
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
});
