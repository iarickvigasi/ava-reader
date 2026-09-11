import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { membershipTestFixture } from './membership-test-fixture';
import { updateCollectionMembership } from './update-collection-membership';

describe('membership ownership and smart guards', () => {
  it.each(['missing', 'foreign', 'archived'])(
    'rejects a %s book before any write',
    async (libraryItemId) => {
      const { options, libraryItem, collectionItem } = membershipTestFixture();
      await expect(
        updateCollectionMembership({ ...options, libraryItemId }),
      ).rejects.toThrow(NotFoundException);
      expect(libraryItem.findFirst).toHaveBeenCalledWith({
        where: { id: libraryItemId, userId: 'user', isArchived: false },
        select: { id: true },
      });
      expect(collectionItem.createMany).not.toHaveBeenCalled();
      expect(collectionItem.deleteMany).not.toHaveBeenCalled();
    },
  );

  it.each(['missing', 'foreign'])(
    'rejects a %s collection without applying valid changes',
    async (id) => {
      const { options, collection, collectionItem } = membershipTestFixture();
      await expect(
        updateCollectionMembership({
          ...options,
          input: { addCollectionIds: ['added'], removeCollectionIds: [id] },
        }),
      ).rejects.toThrow(NotFoundException);
      expect(collection.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['added', id] }, userId: 'user' },
        select: { id: true, kind: true },
      });
      expect(collectionItem.createMany).not.toHaveBeenCalled();
      expect(collectionItem.deleteMany).not.toHaveBeenCalled();
    },
  );

  it.each(['addCollectionIds', 'removeCollectionIds'])(
    'rejects smart targets in %s without partial changes',
    async (direction) => {
      const { options, collectionItem, members } = membershipTestFixture();
      const input = {
        addCollectionIds: ['added'],
        removeCollectionIds: ['removed'],
        [direction]: ['smart'],
      };
      await expect(
        updateCollectionMembership({ ...options, input }),
      ).rejects.toThrow(ForbiddenException);
      expect(collectionItem.createMany).not.toHaveBeenCalled();
      expect(collectionItem.deleteMany).not.toHaveBeenCalled();
      expect(members.get('smart')!.has('book')).toBe(true);
    },
  );
});
