import {
  HttpException,
  ServiceUnavailableException,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { UsersService } from '../../../users/users.service';
import {
  PdfInvestigationInterceptor,
  type PdfAdmissionRequest,
} from './investigation.interceptor';
import {
  beginConversionAdmission,
  refuseConversionAdmission,
} from '../reports/admission';
jest.mock('../reports/admission');
const begin = jest.mocked(beginConversionAdmission),
  refuse = jest.mocked(refuseConversionAdmission);
beforeEach(() => {
  jest.resetAllMocks();
  begin.mockResolvedValue({
    conversionId: 'conversion',
    requestAttemptId: 'request',
    ownerId: 'owner',
  });
  refuse.mockResolvedValue(undefined);
});
function fixture() {
  const request = {
    auth: { clerkUserId: 'clerk' },
    headers: { 'idempotency-key': 'request_key_12345' },
  } as unknown as PdfAdmissionRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const users = {
    getCurrentUserRecord: jest.fn().mockResolvedValue({ id: 'owner' }),
  };
  return {
    request,
    context,
    interceptor: new PdfInvestigationInterceptor(
      {} as PrismaService,
      users as unknown as UsersService,
    ),
  };
}
it('starts durable admission before a capacity/Multer refusal and returns its safe reference', async () => {
  const { context, request, interceptor } = fixture();
  const ordering: string[] = [];
  begin.mockImplementation(() => {
    ordering.push('journal');
    return Promise.resolve({
      conversionId: 'conversion',
      requestAttemptId: 'request',
      ownerId: 'owner',
    });
  });
  const next = {
    handle: () => {
      ordering.push('intake');
      return throwError(
        () =>
          new HttpException(
            {
              code: 'PDF_INTAKE_BUSY',
              message: 'not accepted',
              privateText: 'do not expose',
            },
            503,
          ),
      );
    },
  } as CallHandler;
  const output = await interceptor.intercept(context, next);
  expect(request.pdfAdmission?.conversionId).toBe('conversion');
  const error = (await lastValueFrom(output).catch(
    (value: unknown) => value,
  )) as HttpException;
  expect(ordering).toEqual(['journal', 'intake']);
  expect(refuse).toHaveBeenCalledTimes(1);
  expect(error.getResponse()).toEqual({
    code: 'PDF_INTAKE_BUSY',
    message: 'PDF import was not accepted.',
    investigationId: 'conversion',
  });
});
it('unavailable journal stops before intake or dispatch rather than claiming durable acceptance', async () => {
  const { context, interceptor } = fixture();
  begin.mockRejectedValue(
    new ServiceUnavailableException('journal unavailable'),
  );
  const next = { handle: jest.fn() };
  await expect(
    interceptor.intercept(context, next as unknown as CallHandler),
  ).rejects.toThrow();
  expect(next.handle).not.toHaveBeenCalled();
});
it('captures a synchronous downstream refusal and visibly reports failure to persist its outcome', async () => {
  const { context, interceptor } = fixture();
  refuse.mockRejectedValue(new Error('log unavailable'));
  const output = await interceptor.intercept(context, {
    handle: () => {
      throw new Error('scratch/private');
    },
  } as CallHandler);
  const error = (await lastValueFrom(output).catch(
    (value: unknown) => value,
  )) as HttpException;
  expect(error.getResponse()).toMatchObject({
    code: 'PDF_INVESTIGATION_UNAVAILABLE',
    investigationId: 'conversion',
  });
  expect(JSON.stringify(error.getResponse())).not.toContain('scratch/private');
});
