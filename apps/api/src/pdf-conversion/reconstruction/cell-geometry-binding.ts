import { isDeepStrictEqual } from 'node:util';
import type { RecognitionCellGeometryTask } from './generated/RecognitionCellGeometryTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { geometrySha } from './geometry-binding';
import { cellGeometryAddresses } from './cell-geometry-addresses';
import { recognitionResponse } from './recognition-response';
import { validatePacket } from './validate-packet';
import { exchangeJson } from '../runtime/exchange-json';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function cellGeometryTaskId(task: RecognitionCellGeometryTask) {
  return (
    'recognition-cell-geometry-' +
    geometrySha(
      JSON.stringify([
        task.schema_version,
        task.purpose,
        task.prompt_version,
        task.response_schema_version,
        task.source_sha256,
        task.profile_id,
        task.page_number,
        task.original_task_id,
        task.render_sha256,
        task.native_evidence_sha256,
        task.original_response_sha256,
        task.image.byte_length,
        task.image.width,
        task.image.height,
        task.slots.map((s) => [
          s.slot_id,
          s.segment_index,
          s.segment_id,
          s.row_index,
          s.cell_index,
          s.cell_text_sha256,
          s.original_box_sha256,
          s.context,
          s.row_context,
        ]),
      ]),
    )
  );
}
export function cellGeometryBinding(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
  raw: string,
) {
  const task = validatePacket('RecognitionCellGeometryTask', input);
  if (Buffer.byteLength(raw) > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  exchangeJson(Buffer.from(raw));
  const bound = recognitionResponse(parent, raw);
  const addresses = cellGeometryAddresses(original);
  if (
    task.task_id !== cellGeometryTaskId(task) ||
    task.source_sha256 !== parent.source_sha256 ||
    task.profile_id !== parent.profile_id ||
    task.page_number !== parent.page_number ||
    task.original_task_id !== parent.task_id ||
    task.render_sha256 !== parent.image.sha256 ||
    task.native_evidence_sha256 !== parent.native_evidence_sha256 ||
    !isDeepStrictEqual(task.image, parent.image) ||
    task.original_response_json !== raw ||
    task.original_response_sha256 !== geometrySha(raw) ||
    !isDeepStrictEqual(bound, original) ||
    !addresses.length ||
    !isDeepStrictEqual(
      addresses,
      task.slots.map((s) => [s.segment_index, s.row_index, s.cell_index]),
    )
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  for (const slot of task.slots) {
    const segment = original.segments[slot.segment_index];
    const cell = segment?.cells?.[slot.row_index]?.[slot.cell_index];
    if (
      !cell ||
      segment.kind !== 'table' ||
      cell.source_cell_id != null ||
      !cell.box ||
      slot.segment_id !== segment.id ||
      slot.cell_text_sha256 !== geometrySha(cell.text) ||
      !isDeepStrictEqual(slot.table_box, segment.box) ||
      slot.context !== Array.from(cell.text).slice(0, 256).join('') ||
      !isDeepStrictEqual(
        slot.row_context,
        segment.cells[slot.row_index].map((c) =>
          Array.from(c.text).slice(0, 256).join(''),
        ),
      ) ||
      slot.original_box_sha256 !== geometrySha(slot.original_box_json) ||
      !isDeepStrictEqual(
        exchangeJson(Buffer.from(slot.original_box_json)),
        cell.box,
      ) ||
      slot.slot_id !==
        'cell-geometry-' +
          geometrySha(
            JSON.stringify([
              slot.segment_index,
              slot.segment_id,
              slot.row_index,
              slot.cell_index,
              slot.cell_text_sha256,
              slot.original_box_sha256,
            ]),
          )
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  // Exact installed preflight must still rederive eligibility before any dispatch.
  return task;
}
