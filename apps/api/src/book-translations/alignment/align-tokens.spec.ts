import { alignmentTokens, resolveAlignment } from './align-tokens';

describe('alignment token resolution', () => {
  it('preserves repeated words and UTF-16 offsets without model character counting', () => {
    const source = '😀 go go';
    const target = 'go 😀 go';
    const map = resolveAlignment(
      {
        id: 's',
        groups: [
          { source: [2], translation: [0] },
          { source: [0, 1], translation: [1, 2] },
        ],
      },
      source,
      target,
      alignmentTokens(source, 'en'),
      alignmentTokens(target, 'en'),
    );
    expect(map.groups[0]).toEqual({
      id: '0',
      source: [{ start: 6, end: 8 }],
      translation: [{ start: 0, end: 2 }],
    });
    expect(map.groups[1].source).toEqual([{ start: 0, end: 5 }]);
  });

  it('keeps discontinuous phrases separate and allows unmatched tokens', () => {
    const source = 'ne le fais pas';
    const target = 'do not do it';
    const map = resolveAlignment(
      { id: 's', groups: [{ source: [0, 3], translation: [1] }] },
      source,
      target,
      alignmentTokens(source, 'fr'),
      alignmentTokens(target, 'en'),
    );
    expect(map.groups[0].source).toEqual([
      { start: 0, end: 2 },
      { start: 11, end: 14 },
    ]);
  });

  it('rejects invented or overlapping token IDs', () => {
    const tokens = alignmentTokens('go go', 'en');
    for (const source of [[8], [0, 0]]) {
      expect(() =>
        resolveAlignment(
          { id: 's', groups: [{ source, translation: [0] }] },
          'go go',
          'go go',
          tokens,
          tokens,
        ),
      ).toThrow();
    }
    expect(() =>
      resolveAlignment(
        {
          id: 's',
          groups: [
            { source: [0], translation: [0] },
            { source: [0], translation: [1] },
          ],
        },
        'go go',
        'go go',
        tokens,
        tokens,
      ),
    ).toThrow();
  });

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
    expect(result.version).toBe(2);
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
