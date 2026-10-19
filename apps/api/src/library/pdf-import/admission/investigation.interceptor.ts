import {
  Injectable,
  ServiceUnavailableException,
  HttpException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import {
  from,
  defer,
  catchError,
  switchMap,
  throwError,
  type Observable,
} from 'rxjs';
import type { AuthenticatedRequest } from '../../../auth/authenticated-request';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../../users/users.service';
import {
  beginConversionAdmission,
  refuseConversionAdmission,
  type AdmissionIdentity,
} from '../reports/admission';
import { admissionRefusalResponse } from '../reports/admission-response';
export type PdfAdmissionRequest = AuthenticatedRequest & {
  pdfAdmission?: AdmissionIdentity;
};
@Injectable()
export class PdfInvestigationInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<PdfAdmissionRequest>();
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    const identity = await beginConversionAdmission(
      this.prisma,
      user.id,
      request.headers['idempotency-key'],
    );
    request.pdfAdmission = identity;
    return defer(() => next.handle()).pipe(
      catchError((error: unknown) =>
        from(refuseConversionAdmission(this.prisma, identity, error)).pipe(
          catchError(() =>
            throwError(
              () =>
                new ServiceUnavailableException({
                  code: 'PDF_INVESTIGATION_UNAVAILABLE',
                  message: 'PDF import could not record its outcome.',
                  investigationId: identity.conversionId,
                }),
            ),
          ),
          switchMap(() =>
            throwError(() =>
              error instanceof HttpException
                ? new HttpException(
                    admissionRefusalResponse(error, identity.conversionId),
                    error.getStatus(),
                  )
                : new ServiceUnavailableException({
                    code: 'PDF_ADMISSION_UNAVAILABLE',
                    message: 'PDF import could not complete.',
                    investigationId: identity.conversionId,
                  }),
            ),
          ),
        ),
      ),
    );
  }
}
