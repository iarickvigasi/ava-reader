import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { pythonSemanticValidator } from '../../pdf-conversion/contracts/python-semantic-validator';
import type { SemanticValidator } from '../../pdf-conversion/contracts/types';
let active = 0;
const logger = new Logger('ReaderSemanticValidator');
// Accepted JSON only; never source PDFs. Bound process work on this API instance.
export const readerSemanticValidator: SemanticValidator = async (...args) => {
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
    throw new ServiceUnavailableException('Reader validation is unavailable.');
  } finally {
    active--;
  }
};
export type ReaderCapability = { schema: string; build: string };
export const NO_READER_CAPABILITY: ReaderCapability = { schema: '', build: '' };
