import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { CatalogDatabase } from '../src/database/catalog-database';

export async function verifyPages(
  db: CatalogDatabase,
  get: (path: string) => Promise<Response>,
) {
  const authorId = randomUUID();
  const ids = Array.from({ length: 22 }, () => randomUUID());
  await db.author.create({
    data: { id: authorId, displayName: 'Pagination fixture' },
  });
  try {
    await db.work.createMany({
      data: ids.map((id) => ({ id, originalTitle: 'Page fixture' })),
    });
    await db.workCredit.createMany({
      data: ids.flatMap((workId) => [
        { workId, authorId, role: 'AUTHOR' as const },
        { workId, authorId, role: 'EDITOR' as const },
      ]),
    });
    const first = (await (await get(`/authors/${authorId}/works`)).json()) as {
      items: { id: string }[];
      nextCursor: string;
    };
    assert.equal(first.items.length, 20);
    const second = (await (
      await get(`/authors/${authorId}/works?cursor=${first.nextCursor}`)
    ).json()) as {
      items: { id: string }[];
      nextCursor: null;
    };
    assert.equal(second.items.length, 2);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
      22,
    );
  } finally {
    await db.work.deleteMany({ where: { id: { in: ids } } });
    await db.author.delete({ where: { id: authorId } });
  }
}
