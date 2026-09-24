import { alignmentTokens } from './alignment-tokens';
import { resolveAlignment } from './resolve-alignment';
import { echoedOutput } from './alignment-test-output';

function align(source: string, target: string, pairs: [string[], string[]][]) {
  const s = alignmentTokens(source, 'de');
  const t = alignmentTokens(target, 'uk');
  const output = echoedOutput(
    {
      id: 's',
      groups: pairs.map(([a, b]) => ({
        source: a.map((text) => s.find((token) => token.text === text)!.id),
        translation: b.map(
          (text) => t.find((token) => token.text === text)!.id,
        ),
      })),
    },
    source,
    target,
  );
  return {
    output,
    resolve: () => resolveAlignment(output, source, target, s, t),
  };
}

describe('reported bilingual alignment failures', () => {
  it.each([
    ['annehmen.', 'assume.'],
    ['annehmen.', 'вважають.'],
    ['fördern.', 'promote.'],
  ])(
    'rejects a word matched to punctuation in %s / %s, in either direction',
    (source, target) => {
      const word = alignmentTokens(source, 'de')[0].text;
      const translated = alignmentTokens(target, 'en')[0].text;
      expect(() => align(source, target, [[[word], ['.']]]).resolve()).toThrow(
        'Punctuation-only translation',
      );
      expect(() =>
        align(source, target, [[['.'], [translated]]]).resolve(),
      ).toThrow('Punctuation-only source');
    },
  );

  it('rejects valid but shifted IDs when echoed words name the intended match', () => {
    const test = align('eine Kunst ist', 'is an art', [[['Kunst'], ['an']]]);
    test.output.groups[0].translationText = ['art'];
    expect(test.resolve).toThrow('Mismatched translation token');
    test.output.groups[0].translationText = [];
    expect(test.resolve).toThrow('text count');
  });

  it('preserves reordered word equivalents without forcing unmatched articles', () => {
    const source = 'obwohl die meisten Menschen eine Kunst ist';
    const target = 'although most people is an art';
    const pairs: [string[], string[]][] = [
      [['obwohl'], ['although']],
      [['meisten'], ['most']],
      [['Menschen'], ['people']],
      [['eine'], ['an']],
      [['Kunst'], ['art']],
      [['ist'], ['is']],
    ];
    const map = align(source, target, pairs).resolve();
    expect(
      map.groups.map((g) => [
        g.source.map((s) => source.slice(s.start, s.end)),
        g.translation.map((s) => target.slice(s.start, s.end)),
      ]),
    ).toEqual(pairs);
  });

  it('includes the main verb in a discontinuous German passive construction', () => {
    const source = 'wird von dem, der diese Kunst beherrschen will, verlangt';
    const map = align(source, 'вимагається', [
      [['wird', 'verlangt'], ['вимагається']],
    ]).resolve();
    expect(
      map.groups[0].source.map((s) => source.slice(s.start, s.end)),
    ).toEqual(['wird', 'verlangt']);
    expect(map.groups[0].translation).toEqual([{ start: 0, end: 11 }]);
  });
});
