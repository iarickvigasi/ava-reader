import { BadRequestException } from '@nestjs/common';
import { validateMembershipChanges } from './validate-membership-changes';

describe('membership input', () => {
  it.each([
    null,
    undefined,
    [],
    'collection',
    {},
    { addCollectionIds: [] },
    { addCollectionIds: [], removeCollectionIds: null },
    { addCollectionIds: 'one', removeCollectionIds: [] },
    { addCollectionIds: [null], removeCollectionIds: [] },
    { addCollectionIds: [''], removeCollectionIds: [] },
    { addCollectionIds: [], removeCollectionIds: ['  '] },
    { addCollectionIds: [], removeCollectionIds: [' padded '] },
    { addCollectionIds: ['one'], removeCollectionIds: ['one'] },
  ])('rejects malformed or overlapping changes %p', (input) => {
    expect(() => validateMembershipChanges(input)).toThrow(BadRequestException);
  });

  it('deduplicates each direction and accepts an empty delta', () => {
    expect(
      validateMembershipChanges({
        addCollectionIds: ['one', 'one'],
        removeCollectionIds: ['two', 'two'],
      }),
    ).toEqual({ addCollectionIds: ['one'], removeCollectionIds: ['two'] });
    expect(
      validateMembershipChanges({
        addCollectionIds: [],
        removeCollectionIds: [],
      }),
    ).toEqual({ addCollectionIds: [], removeCollectionIds: [] });
  });
});
