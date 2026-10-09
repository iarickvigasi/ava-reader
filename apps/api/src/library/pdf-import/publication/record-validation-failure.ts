import type { PrismaService } from '../../../prisma/prisma.service';
import type { ValidationAuthority } from './validation-authority';
import { failPdfValidation } from './fail-validation';
import { publicationFailureKind } from './classify-error';
import type { ConversionWorkTiming } from '../reports/work-timing';
export async function recordValidationFailure(
  prisma: PrismaService,
  authority: ValidationAuthority,
  error: unknown,
  work?: ConversionWorkTiming,
) {
  try {
    const result = await failPdfValidation(
      prisma,
      authority,
      publicationFailureKind(error) === 'content',
      work,
    );
    return {
      kind:
        result.status === 'FAILED'
          ? ('failed' as const)
          : ('retry_wait' as const),
      operationId: authority.operationId,
    };
  } catch (failure) {
    if (publicationFailureKind(failure) === 'authority')
      return { kind: 'authority_lost' as const };
    throw failure;
  }
}
