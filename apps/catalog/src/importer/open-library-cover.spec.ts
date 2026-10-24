import { openLibraryCover } from './open-library-cover';

describe('Open Library cover adapter', () => {
  it('stores a complete URL alongside the source cover identifier', () => {
    expect(openLibraryCover([-1, 123])).toEqual({
      coverId: 123,
      coverImageUrl:
        'https://covers.openlibrary.org/b/id/123-L.jpg?default=false',
    });
  });
  it('distinguishes omitted covers from an explicitly empty source array', () => {
    expect(openLibraryCover(undefined)).toEqual({});
    expect(openLibraryCover([])).toEqual({
      coverId: null,
      coverImageUrl: null,
    });
    expect(() => openLibraryCover('invalid')).toThrow(
      'Expected a cover ID array',
    );
  });
});
