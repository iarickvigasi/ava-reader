import { createHash } from 'node:crypto';
import { fixtureBytes } from '../contracts/contract-fixtures';
import type { ContractMap } from '../contracts/types';

export function bundleFixture() {
  const result = JSON.parse(
    fixtureBytes('ava-pdf-worker-result-1').toString(),
  ) as ContractMap['ava-pdf-worker-result-1'];
  if (result.outcome.status !== 'candidate') throw new Error('Fixture');
  const descriptors = [
    result.outcome.canonical_book,
    result.outcome.epub,
    result.outcome.validation_report,
  ];
  const artifacts = descriptors.map((item) => {
    const bytes = Buffer.from(`authored bytes for ${item.id}`);
    item.sha256 = createHash('sha256').update(bytes).digest('hex');
    item.byte_length = bytes.length;
    return { id: item.id, base64: bytes.toString('base64') };
  });
  return { version: 'ava-runtime-bundle-1', result, artifacts };
}
