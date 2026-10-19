import { validateContract } from './validate-contract';
import { validateStructure } from './validate-structure';
import { fixtureBytes } from './contract-fixtures';
import type { ContractName } from './types';

const names: ContractName[] = [
  'ava-book-2',
  'ava-pdf-job-1',
  'ava-pdf-worker-result-1',
  'ava-accepted-content-1',
  'ava-reader-3',
];
describe('shared contract boundary', () => {
  it.each(names)(
    'retains exact %s data without stripping or defaulting',
    async (name) => {
      const bytes = fixtureBytes(name);
      const payload = JSON.parse(bytes.toString()) as unknown;
      const semantic = jest.fn(() => Promise.resolve(true));
      expect(await validateContract(name, bytes, semantic)).toEqual(payload);
      expect(semantic).toHaveBeenCalledWith(name, payload, bytes.toString());
    },
  );
  it('requires semantic acceptance even when structural schema succeeds', async () => {
    await expect(
      validateContract('ava-book-2', fixtureBytes('ava-book-2'), () =>
        Promise.resolve(false),
      ),
    ).rejects.toThrow('INVALID_CONTRACT');
  });
  it('refuses unknown schema, missing hash, extra field and wrong primitive types', () => {
    const payload = JSON.parse(
      fixtureBytes('ava-pdf-job-1').toString(),
    ) as Record<string, unknown>;
    for (const changes of [
      { schema_version: 'future' },
      { config_sha256: undefined },
      { api_key: 'never-allowed' },
      { generation: '1' },
    ]) {
      expect(() =>
        validateStructure('ava-pdf-job-1', { ...payload, ...changes }),
      ).toThrow('INVALID_CONTRACT');
    }
  });
  it('forwards untouched wire JSON so Python can reject duplicate keys', async () => {
    const bytes = Buffer.from(
      fixtureBytes('ava-pdf-job-1')
        .toString()
        .replace('{', '{"generation":99,'),
    );
    const semantic = jest
      .fn<Promise<boolean>, [ContractName, unknown, string]>()
      .mockResolvedValue(false);
    await expect(
      validateContract('ava-pdf-job-1', bytes, semantic),
    ).rejects.toThrow('INVALID_CONTRACT');
    expect(semantic.mock.calls[0]?.[2]).toContain('"generation":99');
  });
});
