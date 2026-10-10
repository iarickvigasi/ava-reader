import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { pythonSemanticValidator } from '../../pdf-conversion/contracts/python-semantic-validator';
import type { ReaderSemanticValidator } from '../../library/pdf-import/reader/reader-validation-cache';
import { installedReaderValidatorIdentity } from './validator-identity';
let active = 0;
const logger = new Logger('ReaderSemanticValidator');
// Accepted JSON only; never source PDFs. Bound process work on this API instance.
export const readerSemanticValidator: ReaderSemanticValidator = Object.assign(
  async (...args: Parameters<ReaderSemanticValidator>) => {
    if (active >= 2)
      throw new ServiceUnavailableException('Reader validation is busy.');
    active++;
    try {
      return await pythonSemanticValidator(
        process.env.AVA_PDF_CONTRACT_PYTHON ?? '',
        (failure) =>
          logger.warn({ event: 'reader_validation_failed', ...failure }),
      )(...args);
    } catch {
      throw new ServiceUnavailableException(
        'Reader validation is unavailable.',
      );
    } finally {
      active--;
    }
  },
  {
    validationIdentity: async () => {
      const executable = process.env.AVA_PDF_CONTRACT_PYTHON ?? '';
      const identity = await installedReaderValidatorIdentity(executable);
      return process.env.AVA_PDF_CONTRACT_PYTHON === executable
        ? identity
        : null;
    },
  },
);
export type ReaderCapability = { schema: string; build: string };
export const NO_READER_CAPABILITY: ReaderCapability = { schema: '', build: '' };
