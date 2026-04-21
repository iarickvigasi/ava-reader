import { resolveZipPath } from './zip-utils';

describe('resolveZipPath', () => {
  it('resolves a sibling file', () => {
    expect(
      resolveZipPath('OEBPS/text/chapter-1.xhtml', 'chapter-2.xhtml'),
    ).toBe('OEBPS/text/chapter-2.xhtml');
  });

  it('resolves a nested relative path', () => {
    expect(
      resolveZipPath('OEBPS/text/chapter-1.xhtml', '../images/cover.png'),
    ).toBe('OEBPS/images/cover.png');
  });

  it('ignores empty segments', () => {
    expect(resolveZipPath('OEBPS/text/chapter-1.xhtml', 'a//b')).toBe(
      'OEBPS/text/a/b',
    );
  });

  it('ignores dot segments', () => {
    expect(resolveZipPath('OEBPS/text/chapter-1.xhtml', './image.png')).toBe(
      'OEBPS/text/image.png',
    );
  });

  it('handles parent directory traversal', () => {
    expect(resolveZipPath('a/b/c.xhtml', '../../d.xhtml')).toBe('d.xhtml');
  });

  it('handles multiple parent traversals beyond root', () => {
    expect(resolveZipPath('a.xhtml', '../../../b.xhtml')).toBe('b.xhtml');
  });

  it('resolves from a root-level base file', () => {
    expect(resolveZipPath('content.opf', 'text/chapter.xhtml')).toBe(
      'text/chapter.xhtml',
    );
  });
});
