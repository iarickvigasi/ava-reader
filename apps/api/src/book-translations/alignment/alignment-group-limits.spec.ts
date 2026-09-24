import { alignmentTokens } from './alignment-tokens';
import { resolveTestAlignment as resolveAlignment } from './alignment-test-output';

describe('alignment token resolution', () => {
  it('rejects clause-sized groups but preserves individual word matches', () => {
    const sourceText = 'zunächst die Fakten über den menschlichen Körper';
    const targetText = 'first the facts about the human body';
    const source = alignmentTokens(sourceText, 'de');
    const target = alignmentTokens(targetText, 'en');
    const ids = source.map((token) => token.id);
    expect(() =>
      resolveAlignment(
        { id: 's', groups: [{ source: ids, translation: ids }] },
        sourceText,
        targetText,
        source,
        target,
      ),
    ).toThrow('Overly broad source group');
    const result = resolveAlignment(
      {
        id: 's',
        groups: ids.map((id) => ({ source: [id], translation: [id] })),
      },
      sourceText,
      targetText,
      source,
      target,
    );
    expect(result.version).toBe(3);
    expect(
      result.groups.map((group) => [
        sourceText.slice(group.source[0].start, group.source[0].end),
        targetText.slice(group.translation[0].start, group.translation[0].end),
      ]),
    ).toEqual([
      ['zunächst', 'first'],
      ['die', 'the'],
      ['Fakten', 'facts'],
      ['über', 'about'],
      ['den', 'the'],
      ['menschlichen', 'human'],
      ['Körper', 'body'],
    ]);
  });

  it('allows short phrase fallbacks and rejects broad groups on the translation side', () => {
    const source = alignmentTokens('aufgeben', 'de');
    const translation = alignmentTokens('give up', 'en');
    expect(
      resolveAlignment(
        { id: 's', groups: [{ source: [0], translation: [0, 1] }] },
        'aufgeben',
        'give up',
        source,
        translation,
      ).groups[0].translation,
    ).toEqual([{ start: 0, end: 7 }]);
    const long = 'one two three four five six seven';
    expect(() =>
      resolveAlignment(
        {
          id: 's',
          groups: [{ source: [0], translation: [0, 1, 2, 3, 4, 5, 6] }],
        },
        'aufgeben',
        long,
        source,
        alignmentTokens(long, 'en'),
      ),
    ).toThrow('Overly broad translation group');
  });

  it('segments CJK and keeps combining marks intact', () => {
    for (const text of [
      '你好世界',
      'e\u0301lan',
      'Привет мир',
      'مرحبا بالعالم',
    ]) {
      for (const token of alignmentTokens(text, null))
        expect(text.slice(token.start, token.end)).toBe(token.text);
    }
    expect(alignmentTokens('e\u0301lan', 'fr')).toEqual([
      { id: 0, text: 'e\u0301lan', start: 0, end: 5 },
    ]);
  });
});
