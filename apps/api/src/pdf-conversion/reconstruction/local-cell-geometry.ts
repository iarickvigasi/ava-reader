import type { RecognitionCellGeometryTask } from './generated/RecognitionCellGeometryTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { exchangeJson } from '../runtime/exchange-json';
import { checksumBuffer } from '../../shared/blob-utils';
import { LOCAL_CELL_OCR_POLICY } from '../../library/pdf-import/admission/cell-ocr-policy';
import { localCellGeometryResult } from './local-cell-geometry-result';

export async function localizeCellGeometry(
  task: RecognitionCellGeometryTask,
  original: RecognitionTask,
  sandbox: CoordinatorDependencies['sandbox'],
  sandboxInput: () => SandboxInput,
  signal: AbortSignal,
) {
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({
      mode: 'localize_cell_geometry',
      method: LOCAL_CELL_OCR_POLICY,
      task,
      original,
    }),
  );
  if (auxiliaryBytes.length > 24 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const input = sandboxInput();
  const output = await sandbox({
    ...input,
    auxiliaryBytes,
    signal: input.signal ? AbortSignal.any([input.signal, signal]) : signal,
    observationCommand: {
      command: 'localize_cell_geometry',
      page_number: null,
    },
  });
  if (output.exitCode !== 0 || output.stdout.length > 512 * 1024)
    throw new PdfRuntimeError('INVALID_RESULT');
  const parsed = localCellGeometryResult.safeParse(exchangeJson(output.stdout));
  if (!parsed.success) throw new PdfRuntimeError('INVALID_RESULT');
  const value = parsed.data,
    tsv = Buffer.from(value.tsv_base64, 'base64');
  if (
    value.request_sha256 !== checksumBuffer(auxiliaryBytes) ||
    value.task_id !== task.task_id ||
    value.source_sha256 !== task.source_sha256 ||
    value.render_sha256 !== task.render_sha256 ||
    value.original_response_sha256 !== task.original_response_sha256 ||
    value.languages !==
      (task.profile_id === 'ava-pdf-prose-en-uk-v3' ? 'eng+ukr' : 'eng') ||
    value.traineddata_sha256.length !== (value.languages === 'eng' ? 1 : 2) ||
    tsv.toString('base64') !== value.tsv_base64 ||
    tsv.length !== value.tsv_byte_length ||
    checksumBuffer(tsv) !== value.tsv_sha256 ||
    (value.status === 'NO_PROOF' &&
      value.reason === 'OCR_UNAVAILABLE' &&
      tsv.length !== 0) ||
    (value.status === 'PROVED' &&
      (tsv.length === 0 ||
        checksumBuffer(Buffer.from(value.response_json)) !==
          value.response_sha256))
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return { ...value, proofSha256: checksumBuffer(output.stdout) };
}
