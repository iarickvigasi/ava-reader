import { EpubLeaseExpired } from './errors';
import { importOutput } from './import-output';
it('preserves the exact supervisor lease-expired classification before retry', async () => {
  const output = importOutput(new Map());
  const marker = Buffer.from(
    '{"version":"ava-runtime-error-1","code":"LEASE_EXPIRED"}\n',
  );
  await expect(output.write(marker)).resolves.toBeUndefined();
  expect(() => output.finish(1)).toThrow(EpubLeaseExpired);
});

it.each([
  '{"version":"ava-runtime-error-1","code":"LEASE_EXPIRED","secret":"never-store"}\n',
  '{"version":"ava-runtime-error-1","code":"OTHER"}\n',
  '{"version":"ava-runtime-error-1","code":"LEASE_EXPIRED"}\nextra',
])('refuses ambiguous or mixed supervisor receipt %s', async (marker) => {
  await expect(
    importOutput(new Map()).write(Buffer.from(marker)),
  ).rejects.toThrow('EPUB_IMPORT_INVALID_RECEIPT');
});
it('does not accept a lease-expired marker with a contradictory successful exit', async () => {
  const output = importOutput(new Map());
  await output.write(
    Buffer.from('{"version":"ava-runtime-error-1","code":"LEASE_EXPIRED"}\n'),
  );
  expect(() => output.finish(0)).toThrow('EPUB_VALIDATOR_UNAVAILABLE');
});
