import { Client } from 'pg';
import { IMPORT_LOCK } from './types';

export async function withImportLock<T>(action: () => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: process.env.CATALOG_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
  });
  await client.connect();
  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [IMPORT_LOCK],
    );
    if (!result.rows[0].acquired)
      throw new Error('Another catalog importer is running');
    return await action();
  } finally {
    await client.end();
  }
}
