import { translationContext } from '../testing/translation.fixture';
import { fixture } from './alignment-test-fixture';
import { generateAlignments, readAlignments } from './sentence-alignments';

describe('saved sentence alignment', () => {
  it('generates against persisted text and reuses a current map without model work', async () => {
    const f = fixture();
    const { model } = f.model({
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
      f.getModel.mockReturnValue(f.model({ sentences: [invalid] }).model);
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
    const repair = f.model({ sentences: [{ ...bad, groups: good.groups }] });
    f.getModel
      .mockReturnValueOnce(f.model({ sentences: [good, bad] }).model)
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
      .mockReturnValueOnce(f.model({ sentences: [good, bad] }).model)
      .mockReturnValue(f.model({ sentences: [bad] }).model);
    const result = await generateAlignments(f.args);
    expect(Object.keys(result)).toEqual([good.id]);
    expect(f.getModel).toHaveBeenCalledTimes(3);
    expect(f.updateMany).toHaveBeenCalledTimes(1);
  });
});
