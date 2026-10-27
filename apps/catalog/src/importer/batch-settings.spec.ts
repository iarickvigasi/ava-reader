import type { ImportRecord } from '#catalog-client';
import { batchSettings } from './batch-settings';
import { recordBytes, recordGroups } from './record-groups';

it('validates bounded integer overrides and preserves conservative defaults', () => {
  expect(batchSettings({})).toMatchObject({
    readSize: 50,
    transactionSize: 25,
  });
  expect(
    batchSettings({
      CATALOG_IMPORT_READ_SIZE: '250',
      CATALOG_IMPORT_TRANSACTION_SIZE: '100',
    }),
  ).toMatchObject({ readSize: 250, transactionSize: 100 });
  for (const value of ['0', '-1', '1.5', 'Infinity', '', '501'])
    expect(() => batchSettings({ CATALOG_IMPORT_READ_SIZE: value })).toThrow();
});

it('preserves order across row/byte boundaries and isolates oversized records', () => {
  const rows = ['a', 'bb', 'x'.repeat(100), 'c'].map((payload, i) => ({
    id: String(i),
    payload,
  })) as ImportRecord[];
  const groups = [
    ...recordGroups(rows, 2, recordBytes(rows[0]) + recordBytes(rows[1])),
  ];
  expect(groups.map((group) => group.map((row) => row.id))).toEqual([
    ['0', '1'],
    ['2'],
    ['3'],
  ]);
  expect(
    [...recordGroups(rows, 1, 1000)].every((group) => group.length === 1),
  ).toBe(true);
});
