import {
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { inspectPdfIsolated } from '../../../pdf-conversion/runtime/inspect-isolated';
import { runtimeConfigFromEnvironment } from '../../../pdf-conversion/runtime/runtime-config';
import { z } from 'zod';
import { PDF_IMPORT_PROFILE } from './profile';
import {
  startConversionWork,
  type ConversionWorkTiming,
} from '../reports/work-timing';
const inspectionFailures = new WeakMap<object, ConversionWorkTiming>();
export const inspectionFailureTiming = (error: unknown) =>
  error !== null && typeof error === 'object'
    ? inspectionFailures.get(error)
    : undefined;

const inspectionSchema = z.object({
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  page_count: z.number().int().min(1).max(PDF_IMPORT_PROFILE.maxPages),
  metadata: z.record(z.string().max(4000)),
  pages: z
    .array(
      z.object({
        width: z.number().positive().finite(),
        height: z.number().positive().finite(),
      }),
    )
    .max(500),
});
export type PdfInspection = z.infer<typeof inspectionSchema>;

export async function inspectPdf(
  bytes: Buffer,
  sourceSha256: string,
): Promise<PdfInspection> {
  const finishWork = startConversionWork();
  try {
    const stdout = await inspectPdfIsolated(
      bytes,
      sourceSha256,
      runtimeConfigFromEnvironment(),
    );
    const envelope = z
      .object({
        accepted: z.boolean(),
        code: z
          .string()
          .regex(/^PDF_[A-Z_]+$/)
          .optional(),
        inspection: inspectionSchema.optional(),
        finding: z
          .object({
            page_number: z.number().int().min(1).max(500),
            annotation_number: z.number().int().min(1).max(1000).optional(),
            relationship_path: z
              .array(z.enum(['/Popup', '/Parent', '/IRT']))
              .max(20)
              .optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .parse(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(stdout)),
      );
    if (envelope.accepted && (envelope.code || envelope.finding))
      throw new Error('Inconsistent admission result');
    if (envelope.finding && !envelope.code)
      throw new Error('Missing refusal code');
    if (!envelope.accepted)
      throw new UnprocessableEntityException({
        code: envelope.code ?? 'PDF_UNSUPPORTED',
        message: 'This PDF is not supported for import.',
        ...(envelope.finding ? { finding: envelope.finding } : {}),
      });
    const result = inspectionSchema.parse(envelope.inspection);
    if (
      result.source_sha256 !== sourceSha256 ||
      result.pages.length !== result.page_count
    )
      throw new Error('Inspection identity');
    return result;
  } catch (error) {
    const failure =
      error instanceof UnprocessableEntityException
        ? error
        : new ServiceUnavailableException('PDF inspection could not complete.');
    const work = finishWork();
    if (work) inspectionFailures.set(failure, work);
    throw failure;
  }
}
