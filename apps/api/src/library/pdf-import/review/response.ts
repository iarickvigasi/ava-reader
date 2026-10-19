import {
  ConflictException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PdfPublicationError } from '../publication/errors';
export async function pdfReviewResponse<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (error instanceof PdfPublicationError) {
      if (error.code === 'PDF_REVIEW_UNAUTHORIZED')
        throw new ForbiddenException('AVA reviewer access required.');
      throw new ConflictException({
        code: error.code,
        message: 'Review is no longer available for this decision.',
      });
    }
    throw new ServiceUnavailableException('Review is temporarily unavailable.');
  }
}
