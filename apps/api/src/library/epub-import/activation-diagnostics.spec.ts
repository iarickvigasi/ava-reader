import type { PrismaService } from '../../prisma/prisma.service';
import { requireReaderQualification } from '../pdf-import/publication/qualification';
import { validateContract } from '../../pdf-conversion/contracts/validate-contract';
import { activateImportedRecord } from './activate-record';
import { claimCanonicalEpub } from './claim';
import { processCanonicalEpubOnce } from './process-once';
import { diagnosticFixture } from './diagnostic-test-fixture';
jest.mock('../pdf-import/publication/qualification');
jest.mock('../../pdf-conversion/contracts/validate-contract');
jest.mock('./activate-record');
jest.mock('./claim');
const priorQualification = process.env.AVA_EPUB_READER_QUALIFICATION_ID;
afterEach(() => {
  if (priorQualification === undefined)
    delete process.env.AVA_EPUB_READER_QUALIFICATION_ID;
  else process.env.AVA_EPUB_READER_QUALIFICATION_ID = priorQualification;
});
beforeEach(() => {
  jest.clearAllMocks();
  process.env.AVA_EPUB_READER_QUALIFICATION_ID = 'qualified';
  jest.mocked(claimCanonicalEpub).mockResolvedValue(null);
  jest
    .mocked(requireReaderQualification)
    .mockResolvedValue({ capabilities: ['text'] } as never);
  jest.mocked(validateContract).mockResolvedValue({
    final_content_id: 'content-0',
    canonical_sha256: '2'.repeat(64),
    required_capabilities: ['text'],
    book: {},
  } as never);
});
it('retains a bounded unavailable activation reason instead of silently dropping it', async () => {
  const { db, events } = diagnosticFixture();
  const sensitive =
    'raw book sentinel sk-test-secret https://private.test/?signature=secret';
  jest.mocked(activateImportedRecord).mockRejectedValue(new Error(sensitive));
  await processCanonicalEpubOnce(db as unknown as PrismaService);
  expect(activateImportedRecord).toHaveBeenCalledTimes(1);
  expect(events).toContainEqual(
    expect.objectContaining({
      stage: 'EPUB_ACTIVATION',
      code: 'ACTIVATION_UNAVAILABLE',
    }),
  );
  expect(JSON.stringify(events)).not.toContain(sensitive);
});
