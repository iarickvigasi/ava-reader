import { createCollection } from './create-collection';
import { validateCollectionInput } from './collection-input';
import type { PrismaService } from '../../prisma/prisma.service';

function setup() {
  const collection = {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ ...data, id: 'new', smartKey: null }),
      ),
  };
  const tx = { collection };
  const transaction = jest
    .fn()
    .mockImplementation((run: (value: typeof tx) => unknown) => run(tx));
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  return { collection, transaction, prisma };
}

describe('create collection', () => {
  it('creates an owned empty custom collection with normalized fields', async () => {
    const { prisma, collection } = setup();
    const result = await createCollection({
      prisma,
      userId: 'user',
      input: { name: '  sci-fi reads  ', description: '  my TBR list  ' },
    });
    expect(collection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'user',
          name: 'Sci-fi reads',
          description: 'My TBR list',
          slug: 'sci-fi-reads',
          kind: 'CUSTOM',
        },
      }),
    );
    expect(result.collection).toMatchObject({
      books: [],
      itemCount: 0,
      unreadCount: 0,
      completionItems: [],
    });
  });

  it('rejects another collection title regardless of case within this user', async () => {
    const { prisma, collection } = setup();
    collection.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      createCollection({ prisma, userId: 'user', input: { name: 'READS' } }),
    ).rejects.toThrow('already exists');
    expect(collection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user',
          name: { equals: 'READS', mode: 'insensitive' },
        },
      }),
    );
    expect(collection.create).not.toHaveBeenCalled();
  });

  it('resolves slug collisions for distinct titles', async () => {
    const { prisma, collection } = setup();
    collection.findUnique.mockResolvedValueOnce({ id: 'existing' });
    const result = await createCollection({
      prisma,
      userId: 'user',
      input: { name: 'Sci-fi reads!' },
    });
    expect(result.collection.slug).toBe('sci-fi-reads-2');
  });

  it('retries a serialization conflict before returning success', async () => {
    const { prisma, transaction } = setup();
    transaction.mockRejectedValueOnce({ code: 'P2034' });
    await createCollection({
      prisma,
      userId: 'user',
      input: { name: 'Reads' },
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });
});

describe('collection input', () => {
  it.each([undefined, null, 42, {}, '', '   '])(
    'rejects invalid title %p',
    (name) => {
      expect(() => validateCollectionInput({ name })).toThrow();
    },
  );
  it('enforces lengths after trimming and capitalization', () => {
    expect(() => validateCollectionInput({ name: 'x'.repeat(101) })).toThrow();
    expect(() =>
      validateCollectionInput({ name: 'Reads', description: 'x'.repeat(1001) }),
    ).toThrow();
    expect(
      validateCollectionInput({
        name: ' ' + 'x'.repeat(100) + ' ',
        description: ' '.repeat(1100),
      }).description,
    ).toBeNull();
    expect(() =>
      validateCollectionInput({ name: 'Reads', description: {} }),
    ).toThrow();
  });
  it('preserves words, line breaks, and multilingual text', () => {
    expect(
      validateCollectionInput({
        name: ' 📚 українські книги ',
        description: ' première ligne\nseconde ligne ',
      }),
    ).toEqual({
      name: '📚 Українські книги',
      description: 'Première ligne\nseconde ligne',
    });
  });
});
