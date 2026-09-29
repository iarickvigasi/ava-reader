import { ContractError } from '../contracts/contract-error';
import { PdfJobError } from '../../library/pdf-import/jobs/errors';
import { failureCode } from './failure-code';

describe('worker failure recovery classification', () => {
  it.each([
    [new PdfJobError('SOURCE_MISMATCH'), 'SOURCE_MISMATCH'],
    [new PdfJobError('PDF_JOB_ARTIFACT_INVALID'), 'INVALID_RESULT'],
    [new PdfJobError('PDF_JOB_ARTIFACT_LIMIT'), 'INVALID_RESULT'],
    [new PdfJobError('PDF_JOB_RESULT_LIMIT'), 'INVALID_RESULT'],
    [new ContractError('INVALID_CONTRACT'), 'INVALID_RESULT'],
    [new ContractError('VALIDATOR_UNAVAILABLE'), 'WORKER_CRASH'],
    [new Error('private database detail'), 'WORKER_CRASH'],
  ])(
    'keeps known corruption terminal and infrastructure recoverable',
    (error, expected) => {
      expect(failureCode(error)).toBe(expected);
    },
  );
});
