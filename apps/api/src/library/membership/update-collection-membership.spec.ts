import { membershipTestFixture } from './membership-test-fixture';
import { updateCollectionMembership } from './update-collection-membership';

describe('update collection membership', () => {
  it('applies a delta and returns full affected shelves and all book memberships', async () => {
    const { options, members, transaction, collectionItem } =
      membershipTestFixture();
    const result = await updateCollectionMembership(options);
    expect([...members.get('added')!]).toContain('book');
    expect([...members.get('removed')!]).not.toContain('book');
    expect(result.collections.map(({ id }) => id)).toEqual([
      'smart',
      'added',
      'untouched',
    ]);
    expect(result.affectedCollections.map(({ id }) => id)).toEqual([
      'added',
      'removed',
    ]);
    expect(result.affectedCollections[0]).toMatchObject({
      itemCount: 6,
      unreadCount: 6,
    });
    expect(result.affectedCollections[0].books).toHaveLength(6);
    expect(result.affectedCollections[1]).toMatchObject({
      books: [],
      itemCount: 0,
      unreadCount: 0,
    });
    expect(collectionItem.createMany).toHaveBeenCalledWith({
      data: [{ collectionId: 'added', libraryItemId: 'book' }],
      skipDuplicates: true,
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('replays the same changes without duplicate members and includes repeated removals', async () => {
    const { options } = membershipTestFixture();
    const first = await updateCollectionMembership(options);
    const repeated = await updateCollectionMembership(options);
    expect(repeated).toEqual(first);
  });

  it('accepts an empty delta without writing any memberships', async () => {
    const { options, collectionItem } = membershipTestFixture();
    const result = await updateCollectionMembership({
      ...options,
      input: { addCollectionIds: [], removeCollectionIds: [] },
    });
    expect(result.affectedCollections).toEqual([]);
    expect(result.collections.map(({ id }) => id)).toEqual([
      'smart',
      'removed',
      'untouched',
    ]);
    expect(collectionItem.createMany).not.toHaveBeenCalled();
    expect(collectionItem.deleteMany).not.toHaveBeenCalled();
  });

  it('retries serialization conflicts and stops after the bounded retry count', async () => {
    const { options, transaction } = membershipTestFixture();
    transaction.mockRejectedValueOnce({ code: 'P2034' } as never);
    await updateCollectionMembership(options);
    expect(transaction).toHaveBeenCalledTimes(2);
    transaction.mockClear().mockRejectedValue({ code: 'P2034' } as never);
    await expect(updateCollectionMembership(options)).rejects.toEqual({
      code: 'P2034',
    });
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry unrelated database errors', async () => {
    const { options, transaction } = membershipTestFixture();
    transaction.mockRejectedValueOnce({ code: 'P2003' } as never);
    await expect(updateCollectionMembership(options)).rejects.toEqual({
      code: 'P2003',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
