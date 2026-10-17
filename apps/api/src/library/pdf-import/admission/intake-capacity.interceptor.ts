import {
  Injectable,
  ServiceUnavailableException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { defer, finalize, type Observable } from 'rxjs';

const MAX_ACTIVE_INTAKES = 2;
let activeIntakes = 0;

@Injectable()
export class PdfIntakeCapacityInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return defer(() => {
      if (activeIntakes >= MAX_ACTIVE_INTAKES)
        throw new ServiceUnavailableException({
          code: 'PDF_INTAKE_BUSY',
          message: 'PDF import is busy. The upload was not accepted.',
        });
      activeIntakes++;
      return defer(() => next.handle()).pipe(
        finalize(() => {
          activeIntakes--;
        }),
      );
    });
  }
}
