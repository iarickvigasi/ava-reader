import {
  importedEpubAuthority,
  type EpubAuthorityStore,
} from '../../library/epub-import/authority';
import { publishedPdfAuthority } from '../../library/pdf-import/reader/published-authority';
import {
  assertCanonicalContentAuthority,
  canonicalContentAuthority,
} from './content-authority';
import { importedFixture } from './imported-fixture';
jest.mock('../../library/epub-import/authority');
jest.mock('../../library/pdf-import/reader/published-authority');
const authorize = jest.mocked(importedEpubAuthority),
  capability = { schema: 'ava-reader-3', build: 'b'.repeat(64) };
beforeEach(() => {
  authorize.mockReset();
  jest.mocked(publishedPdfAuthority).mockReset();
});
it('checks exact immutable source and reader pins under imported ownership', async () => {
  const { accepted } = importedFixture();
  authorize.mockResolvedValue({ record: accepted.importRecord } as Awaited<
    ReturnType<typeof importedEpubAuthority>
  >);
  await assertCanonicalContentAuthority(
    {} as EpubAuthorityStore,
    'owner',
    'library',
    canonicalContentAuthority(accepted),
    capability,
  );
  expect(authorize).toHaveBeenCalledWith(
    expect.anything(),
    'owner',
    'import',
    'ava-reader-3',
    'b'.repeat(64),
  );
  expect(publishedPdfAuthority).not.toHaveBeenCalled();
});
it.each([
  'libraryItemId',
  'finalContentId',
  'sourceSha256',
  'readerSha256',
] as const)('refuses substituted imported %s', (field) => {
  const { accepted } = importedFixture();
  authorize.mockResolvedValue({
    record: { ...accepted.importRecord, [field]: 'substituted' },
  } as Awaited<ReturnType<typeof importedEpubAuthority>>);
  return expect(
    assertCanonicalContentAuthority(
      {} as EpubAuthorityStore,
      'owner',
      'library',
      canonicalContentAuthority(accepted),
      capability,
    ),
  ).rejects.toThrow('Accepted content changed');
});
