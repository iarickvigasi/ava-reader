import { recordValidationFailure } from './record-validation-failure';
import { failPdfValidation } from './fail-validation';
import { PdfPublicationError } from './errors';
import { JobAuthorityError } from '../jobs/errors';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ValidationAuthority } from './validation-authority';
jest.mock('./fail-validation');
const fail = jest.mocked(failPdfValidation);
// This dependency is only forwarded to the mocked persistence boundary.
const prisma = {} as PrismaService;
const authority: ValidationAuthority = {
  principalId: 'test-worker',
  token: 'test-token',
  operationId: 'one',
  fence: 1,
  validationToken: 'test-validation-token',
};
const args: Parameters<typeof recordValidationFailure> = [
  prisma,
  authority,
  new Error('validator unavailable'),
];
it.each([
  new JobAuthorityError(),
  new PdfPublicationError('PDF_VALIDATION_AUTHORITY_INVALID'),
])(
  'returns safe authority loss if failure persistence is fenced',
  async (error) => {
    fail.mockRejectedValueOnce(error);
    await expect(recordValidationFailure(...args)).resolves.toEqual({
      kind: 'authority_lost',
    });
  },
);
it('preserves infrastructure failures for operator handling', async () => {
  fail.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(recordValidationFailure(...args)).rejects.toThrow(
    'database unavailable',
  );
});
it('forwards observed work while preserving fenced failure handling', async () => {
  const work = {
    startedAt: '2026-10-09T20:00:00.000Z',
    endedAt: '2026-10-09T20:00:00.025Z',
    durationMs: 25,
  };
  fail.mockRejectedValueOnce(new JobAuthorityError());
  await expect(
    recordValidationFailure(prisma, authority, args[2], work),
  ).resolves.toEqual({ kind: 'authority_lost' });
  expect(fail).toHaveBeenLastCalledWith(prisma, authority, false, work);
});
