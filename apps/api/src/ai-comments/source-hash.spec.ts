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

  it('changes when the selection context changes', () => {
    const base = { kind: 'EXPLAIN', text: 'hello', model: 'm' };
    const a = buildSourceHash({ ...base, context: 'He waved. Hello there.' });
    const b = buildSourceHash({ ...base, context: 'She left. Hello again.' });
    expect(a).not.toBe(b);
  });

  it('changes when the book title changes', () => {
    const base = { kind: 'EXPLAIN', text: 'hello', model: 'm' };
    const a = buildSourceHash({ ...base, bookTitle: 'Book A' });
    const b = buildSourceHash({ ...base, bookTitle: 'Book B' });
    expect(a).not.toBe(b);
  });

  it('changes when the author changes', () => {
    const base = {
      kind: 'TRANSLATE',
      text: 'hello',
      targetLang: 'fr',
      model: 'm',
    };
    const a = buildSourceHash({ ...base, author: 'Author A' });
    const b = buildSourceHash({ ...base, author: 'Author B' });
    expect(a).not.toBe(b);
  });

  it('treats missing context fields the same as empty strings', () => {
    const base = { kind: 'EXPLAIN', text: 'hello', model: 'm' };
    const a = buildSourceHash({
      ...base,
      context: '',
      bookTitle: '',
      author: '',
    });
    const b = buildSourceHash(base);
    expect(a).toBe(b);
  });

  it('normalizes context whitespace before hashing', () => {
    const base = { kind: 'EXPLAIN', text: 'hello', model: 'm' };
    const a = buildSourceHash({ ...base, context: 'He  waved.\nHello there.' });
    const b = buildSourceHash({ ...base, context: 'He waved. Hello there.' });
    expect(a).toBe(b);
  });
});
