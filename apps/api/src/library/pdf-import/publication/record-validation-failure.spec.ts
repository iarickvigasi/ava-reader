import { recordValidationFailure } from './record-validation-failure';
import { failPdfValidation } from './fail-validation';
import { PdfPublicationError } from './errors';
import { JobAuthorityError } from '../jobs/errors';
jest.mock('./fail-validation');
const fail = jest.mocked(failPdfValidation);
const args = [
  {},
  { operationId: 'one' },
  new Error('validator unavailable'),
] as Parameters<typeof recordValidationFailure>;
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
