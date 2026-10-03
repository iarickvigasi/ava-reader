import type { PrismaService } from '../../prisma/prisma.service';
import {
  failPdfJob,
  type AttemptAuthority,
} from '../../library/pdf-import/jobs';
import { PdfProviderError } from '../../library/pdf-import/providers/errors';
import { waitPdfJobForProvider } from '../../library/pdf-import/providers/wait-job';
import { failureCode } from './failure-code';

export async function settleExecutionFailure(
  prisma: PrismaService,
  authority: AttemptAuthority,
  error: unknown,
) {
  if (error instanceof PdfProviderError) {
    if (
      [
        'PDF_PROVIDER_BUDGET_EXHAUSTED',
        'PDF_PROVIDER_OUTCOME_UNCERTAIN',
        'PDF_PROVIDER_ROUTE_UNAVAILABLE',
      ].includes(error.code)
    )
      return {
        ...(await waitPdfJobForProvider(prisma, authority, error.code)),
        code: error.code,
      };
    const code =
      error.code === 'PDF_PROVIDER_OUTPUT_INVALID'
        ? 'INVALID_RESULT'
        : 'DISPATCH_NOT_AUTHORIZED';
    return { ...(await failPdfJob(prisma, authority, code)), code };
  }
  const code = failureCode(error);
  return { ...(await failPdfJob(prisma, authority, code)), code };
}
