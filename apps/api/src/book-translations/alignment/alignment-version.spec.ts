import { fixture } from './alignment-test-fixture';
import { generateAlignments } from './sentence-alignments';

describe('saved sentence alignment', () => {
  it('bypasses a saved alignment when explicitly regenerating', async () => {
    const f = fixture();
    f.row.alignment = {
      version: 3,
      sourceText: f.row.sourceText,
      translatedText: f.row.translatedText,
      groups: [],
    };
    f.getModel.mockReturnValue(
      f.model({
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
      version: 3,
      sourceText: f.row.sourceText,
      translatedText: f.row.translatedText,
      groups: [],
    };
    f.getModel.mockReturnValue(f.model({ sentences: [] }).model);
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
