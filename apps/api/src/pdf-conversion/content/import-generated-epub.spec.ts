import { fixtureBytes } from '../contracts/contract-fixtures';
import { parseContractJson } from '../contracts/parse-json';
import type { ContractMap } from '../contracts/types';
import { importGeneratedEpub } from './import-generated-epub';

const fixture = parseContractJson(
  fixtureBytes('ava-reader-3'),
) as ContractMap['ava-reader-3'];
const context = {
  finalContentId: fixture.final_content_id,
  canonicalSha256: fixture.canonical_sha256,
  sourceSha256: fixture.book.source.sha256,
};
const input = {
  epub: Buffer.from('bridge output tested separately'),
  context,
  semantic: () => Promise.resolve(true),
  reimport: () => Promise.resolve(fixtureBytes('ava-reader-3')),
  client: { versions: [3], capabilities: fixture.required_capabilities },
};

describe('explicit generated EPUB boundary', () => {
  it('requires v3 capability support and never grants publication', async () => {
    const good = await importGeneratedEpub(input);
    expect(good.negotiation).toMatchObject({
      status: 'compatible',
      version: 3,
    });
    expect(good.conservation).toMatchObject({
      epubConservation: 'pass',
      publicationEligible: false,
      actualReader: 'not_run',
    });
    for (const client of [
      { versions: [2], capabilities: [] },
      { versions: [3], capabilities: [] },
    ]) {
      expect(
        (await importGeneratedEpub({ ...input, client })).negotiation.status,
      ).toBe('upgrade_required');
    }
  });
  it.each(['finalContentId', 'canonicalSha256', 'sourceSha256'] as const)(
    'rejects a substituted %s',
    async (key) => {
      await expect(
        importGeneratedEpub({
          ...input,
          context: { ...context, [key]: 'mismatch' },
        }),
      ).rejects.toThrow('INVALID_CONTRACT');
    },
  );
  it('propagates failed EPUB verification without fallback to ordinary import', async () => {
    await expect(
      importGeneratedEpub({
        ...input,
        reimport: () => Promise.reject(new Error('INVALID_EPUB')),
      }),
    ).rejects.toThrow('INVALID_EPUB');
  });
});
