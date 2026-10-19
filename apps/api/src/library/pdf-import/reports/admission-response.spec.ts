import {
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { admissionRefusalResponse } from './admission-response';

it.each([500, 502, 503, 504])(
  'reports untyped service failure %s as unavailable without disclosing private detail',
  (status) => {
    const error = new HttpException(
      'private inspection failure detail',
      status,
    );
    expect(admissionRefusalResponse(error, 'pdf-investigation')).toEqual({
      code: 'PDF_ADMISSION_UNAVAILABLE',
      message: 'PDF import was not accepted.',
      investigationId: 'pdf-investigation',
    });
    expect(error.getStatus()).toBe(status);
  },
);

it.each<[HttpException, string]>([
  [new BadRequestException('invalid file'), 'PDF_UPLOAD_INVALID'],
  [new PayloadTooLargeException('too large'), 'PDF_UPLOAD_TOO_LARGE'],
  [
    new UnprocessableEntityException({ code: 'PDF_ENCRYPTED' }),
    'PDF_ENCRYPTED',
  ],
  [
    new ServiceUnavailableException({ code: 'PDF_INVESTIGATION_UNAVAILABLE' }),
    'PDF_INVESTIGATION_UNAVAILABLE',
  ],
])('preserves known refusal classification for %s', (error, code) => {
  expect(admissionRefusalResponse(error, 'pdf-investigation').code).toBe(code);
});

it('does not turn an unsafe server code into an invalid-file diagnosis', () => {
  const error = new ServiceUnavailableException({
    code: 'private server detail/unsafe code',
  });
  expect(admissionRefusalResponse(error, 'pdf-investigation').code).toBe(
    'PDF_ADMISSION_UNAVAILABLE',
  );
});

it('preserves accepted-operation identity when only report completion fails', () => {
  const error = new ServiceUnavailableException({
    code: 'PDF_IMPORT_ACCEPTED_REPORT_PENDING',
    operationId: 'pdf-existing-operation',
    libraryItemId: 'existing-library-item',
    status: 'QUEUED',
  });
  expect(admissionRefusalResponse(error, 'pdf-investigation')).toEqual({
    code: 'PDF_IMPORT_ACCEPTED_REPORT_PENDING',
    message: 'PDF import was accepted, but its report could not finish.',
    investigationId: 'pdf-investigation',
    operationId: 'pdf-existing-operation',
    libraryItemId: 'existing-library-item',
    status: 'QUEUED',
  });
});
