import { fixture } from './alignment-test-fixture';
import { generateAlignments } from './generate-alignments';
import { stubModel } from '../../book-analysis/chapter-purpose/model.fixture';
import { echoedOutput } from './alignment-test-output';

it.each(['punctuation', 'shifted ID'])(
  'repairs the whole sentence after %s without saving its bad neighbors',
  async (failure) => {
    const f = fixture();
    f.row.sourceText = 'zweifellos annehmen.';
    f.row.translatedText = 'undoubtedly assume.';
    f.args.context.units[0].text = f.row.sourceText;
    const bad = echoedOutput(
      {
        id: f.row.sentenceId,
        groups: [
          { source: [0], translation: [1] },
          { source: [1], translation: [2] },
        ],
      },
      f.row.sourceText,
      f.row.translatedText,
    );
    if (failure === 'shifted ID')
      bad.groups[0].translationText = ['undoubtedly'];
    const repair = f.model({
      sentences: [
        {
          id: f.row.sentenceId,
          groups: [
            { source: [0], translation: [0] },
            { source: [1], translation: [1] },
          ],
        },
      ],
    });
    f.getModel
      .mockReturnValueOnce(stubModel({ sentences: [bad] }).model)
      .mockReturnValue(repair.model);
    const result = await generateAlignments(f.args);
    expect(f.updateMany).toHaveBeenCalledTimes(1);
    expect(f.getModel).toHaveBeenCalledTimes(2);
    expect(repair.prompts[0]).toContain(
      failure === 'punctuation'
        ? 'Punctuation-only'
        : 'Mismatched translation token',
    );
    expect(
      result[f.row.sentenceId].groups.map((g) =>
        g.translation.map((s) => f.row.translatedText.slice(s.start, s.end)),
      ),
    ).toEqual([['undoubtedly'], ['assume']]);
  },
);
