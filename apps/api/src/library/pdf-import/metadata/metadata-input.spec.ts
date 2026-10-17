import { parsePdfMetadata } from './metadata-input';

describe('PDF metadata ownership boundary', () => {
  it('allows explicit empty user authors and language without losing edit intent', () => {
    expect(
      parsePdfMetadata({ expectedVersion: 0, authors: [], language: null }),
    ).toEqual({ expectedVersion: 0, authors: [], language: null });
  });
  it.each([
    { title: 'No version' },
    { expectedVersion: -1, title: 'Bad' },
    { expectedVersion: 0 },
    { expectedVersion: 0, ownerId: 'other', title: 'Bad' },
    { expectedVersion: 0, finalContentId: 'fake', title: 'Bad' },
    { expectedVersion: 0, title: '   ' },
  ])('rejects missing CAS or unrelated authority fields', (input) => {
    expect(() => parsePdfMetadata(input)).toThrow('Invalid metadata update');
  });
});
