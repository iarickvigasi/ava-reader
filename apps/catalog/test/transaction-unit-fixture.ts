import type { ImportRecord } from '#catalog-client';
import type { CatalogDatabase } from '../src/database/catalog-database';
export const records = [1, 2].map((n) => ({
  id: String(n),
  externalId: `/authors/${n}`,
  kind: 'AUTHOR',
  runId: 'run',
})) as ImportRecord[];
const tx = { $executeRaw: jest.fn() };
export const db = {
  $transaction: jest.fn((action: (value: typeof tx) => Promise<number>) =>
    action(tx),
  ),
} as unknown as CatalogDatabase;
export const metrics = () => ({
  transactions: 0,
  bulkRecords: 0,
  fallbackRecords: 0,
  transactionMs: 0,
  recordWriteMs: 0,
});
