import { isDeepStrictEqual } from 'node:util';
import { checksumBuffer } from '../../shared/blob-utils';
import type { AttemptContext } from './attempt-provider';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function wordWrapBatch(payload: unknown, context: AttemptContext) {
  const batch = validatePacket('WordWrapBatch', payload);
  if (
    batch.source_sha256 !== context.sourceSha256 ||
    batch.profile_id !== context.profileId ||
    batch.policy !== context.sourceNormalizationPolicy
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (Buffer.byteLength(JSON.stringify(batch)) > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const entries = batch.tasks.flatMap((task) => task.entries);
  const requested = batch.entries.filter(
    (entry) => (entry.reused_authority ?? null) === null,
  );
  const eligible = batch.census.filter(
    (entry) => entry.classification === 'eligible',
  );
  const census = batch.census.map((entry) =>
    Object.fromEntries(
      Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );
  if (
    checksumBuffer(Buffer.from(JSON.stringify(census))) !==
      batch.census_sha256 ||
    !isDeepStrictEqual(entries, requested) ||
    eligible.length !== batch.entries.length ||
    eligible.some((item, index) => {
      const entry = batch.entries[index];
      return (
        item.entry_id !== entry.id ||
        item.line_id !== entry.left.line_id ||
        item.page !== entry.left.page ||
        item.text_sha256 !== entry.left.text_sha256 ||
        item.owner_id !== entry.owner_id ||
        item.next_line_id !== entry.right.line_id ||
        item.resolution !==
          ((entry.reused_authority ?? null) === null ? 'request' : 'reuse')
      );
    }) ||
    new Set(batch.entries.map((entry) => entry.id)).size !==
      batch.entries.length ||
    new Set(batch.census.map((entry) => entry.line_id)).size !==
      batch.census.length
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  if (
    new Set(batch.tasks.map((task) => task.task_id)).size !==
      batch.tasks.length ||
    new Set(entries.map((entry) => entry.id)).size !== entries.length ||
    batch.tasks.some(
      (task, index) =>
        task.batch_index !== index ||
        task.batch_count !== batch.tasks.length ||
        task.source_sha256 !== batch.source_sha256 ||
        task.profile_id !== batch.profile_id ||
        task.policy !== batch.policy ||
        task.observation_sha256 !== batch.observation_sha256 ||
        task.catalogue_sha256 !== batch.catalogue_sha256,
    )
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  return batch;
}
