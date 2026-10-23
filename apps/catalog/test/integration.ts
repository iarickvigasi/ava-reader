import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { CatalogDatabase } from '../src/database/catalog-database';
import { seedDemo } from '../scripts/seed-demo';
import { demo } from '../scripts/demo-data';
import { verifyConstraints } from './verify-constraints';
import { verifyPages } from './verify-pages';

async function integration() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  try {
    const db = app.get(CatalogDatabase);
    await seedDemo(db);
    await seedDemo(db);
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api`;
    const get = async (path: string) => fetch(`${base}${path}`);
    assert.equal((await get('/health')).status, 200);
    const work = (await (await get(`/works/${demo.workId}`)).json()) as {
      credits: { author: { id: string } }[];
    };
    assert.equal(work.credits[0].author.id, demo.authorId);
    const author = (await (await get(`/authors/${demo.authorId}`)).json()) as {
      aliases: { name: string }[];
    };
    assert.equal(author.aliases[0].name, 'Алекс Пример');
    const editions = (await (
      await get(`/works/${demo.workId}/editions`)
    ).json()) as {
      items: { id: string }[];
    };
    assert.equal(editions.items[0].id, demo.editionId);
    for (const path of [
      '/works/not-a-uuid',
      `/authors/${demo.authorId}/works?cursor=bad`,
    ]) {
      assert.equal((await get(path)).status, 400);
    }
    const missing = '90000000-0000-4000-8000-000000000001';
    for (const path of [
      `/works/${missing}`,
      `/authors/${missing}`,
      `/works/${missing}/editions`,
    ]) {
      assert.equal((await get(path)).status, 404);
    }
    assert.equal(
      (await fetch(`${base}/works/${demo.workId}`, { method: 'POST' })).status,
      404,
    );
    await verifyConstraints(db);
    await verifyPages(db, get);
    console.log(
      'Catalog integration checks passed (HTTP, replay, constraints, pagination).',
    );
  } finally {
    await app.close();
  }
}
integration().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
