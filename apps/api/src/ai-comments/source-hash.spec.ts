import { buildSourceHash, normalizeSelectionText } from './source-hash';

describe('normalizeSelectionText', () => {
  it('collapses internal whitespace and trims', () => {
    expect(normalizeSelectionText('  hello   world  \n')).toBe('hello world');
  });

  it('strips a wrapping pair of straight quotes', () => {
    expect(normalizeSelectionText('"hello world"')).toBe('hello world');
  });

  it('strips a wrapping pair of curly quotes', () => {
    expect(normalizeSelectionText('\u201Chello world\u201D')).toBe(
      'hello world',
    );
  });

  it('leaves an unmatched quote pair alone', () => {
    expect(normalizeSelectionText('"hello world')).toBe('"hello world');
  });

  it('does not strip nested quotes', () => {
    // Only the outermost wrapping pair should be removed.
    expect(normalizeSelectionText('"she said "go""')).toBe('she said "go"');
  });
});

describe('buildSourceHash', () => {
  it('produces identical hashes for inputs that normalize to the same string', () => {
    const a = buildSourceHash({
      kind: 'TRANSLATE',
      text: '  "hello"  ',
      targetLang: 'fr',
      model: 'm',
    });
    const b = buildSourceHash({
      kind: 'TRANSLATE',
      text: 'hello',
      targetLang: 'fr',
      model: 'm',
    });
    expect(a).toBe(b);
  });

  it('changes when the model changes', () => {
    const a = buildSourceHash({
      kind: 'TRANSLATE',
      text: 'hello',
      targetLang: 'fr',
      model: 'm-1',
    });
    const b = buildSourceHash({
      kind: 'TRANSLATE',
      text: 'hello',
      targetLang: 'fr',
      model: 'm-2',
    });
    expect(a).not.toBe(b);
  });

  it('changes when the kind changes', () => {
    const a = buildSourceHash({
      kind: 'TRANSLATE',
      text: 'hello',
      targetLang: 'fr',
      model: 'm',
    });
    const b = buildSourceHash({
      kind: 'EXPLAIN',
      text: 'hello',
      targetLang: 'fr',
      model: 'm',
    });
    expect(a).not.toBe(b);
  });

  it('treats a missing target language the same as an empty string', () => {
    const a = buildSourceHash({
      kind: 'ETYMOLOGY',
      text: 'hello',
      targetLang: null,
      model: 'm',
    });
    const b = buildSourceHash({
      kind: 'ETYMOLOGY',
      text: 'hello',
      model: 'm',
    });
    expect(a).toBe(b);
  });
});
