import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { verifyBrowseValidation } from './verify-browse-validation';
import { createBrowseFixtures } from './create-browse-fixtures';
import type { CatalogDatabase } from '../src/database/catalog-database';

type Page = {
  items: { id: string; editions: { coverImageUrl: string }[] }[];
  nextCursor: string | null;
};

export async function verifyBrowse(
  db: CatalogDatabase,
  get: (path: string) => Promise<Response>,
) {
  const authorId = randomUUID();
  const workIds = Array.from({ length: 23 }, () => randomUUID()).sort();
  const marker = `Browse-${authorId}`;
  const page = async (query: string) => {
    const response = await get(`/works?${query}`);
    assert.equal(response.status, 200);
    return response.json() as Promise<Page>;
  };
  try {
    await createBrowseFixtures(db, { authorId, marker, workIds });
    const screen = await page(`query=${marker}&limit=5`);
    assert.equal(screen.items.length, 5);
    assert.equal(screen.nextCursor, workIds[4]);
    const first = await page(`query=${marker}`);
    assert.equal(first.items.length, 20);
    assert.equal(
      first.items.find((item) => item.id === workIds[0])?.editions[0]
        .coverImageUrl,
      'https://books.example.test/covers/2222.jpg',
    );
    assert.equal(first.nextCursor, workIds[19]);
    const second = await page(`query=${marker}&cursor=${first.nextCursor}`);
    assert.equal(second.items.length, 3);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((row) => row.id)).size,
      23,
    );
    assert.equal((await page(`query=Alias-${authorId}`)).items.length, 20);
    assert.equal(
      (await page(`query=${marker}&languages=en&filters=readable`)).items
        .length,
      0,
    );
    assert.equal(
      (await page(`query=${marker}&languages=ru&filters=readable`)).items
        .length,
      1,
    );
    assert.equal(
      (await page('query=0-306-40615-2')).items.some(
        (row) => row.id === workIds[0],
      ),
      true,
    );
    assert.equal(
      (await page(`query=${marker}&filters=readable`)).items.length,
      1,
    );
    assert.equal(
      (await page('query=%25')).items.some((row) => row.id === workIds[0]),
      false,
    );
    assert.equal(
      (await page(`query=${marker}&filters=history`)).items.length,
      0,
    );
    assert.equal(
      (await page(`query=${marker}&filters=fantasy,history`)).items.length,
      20,
    );
    assert.equal(
      (await page(`query=${marker}&filters=fantasy,readable&languages=ru`))
        .items.length,
      1,
    );
    await verifyBrowseValidation(get);
  } finally {
    await db.readingAsset.deleteMany({
      where: { edition: { workId: { in: workIds } } },
    });
    await db.edition.deleteMany({ where: { workId: { in: workIds } } });
    await db.work.deleteMany({ where: { id: { in: workIds } } });
    await db.author.deleteMany({ where: { id: authorId } });
  }
}
