import { createHash } from 'node:crypto';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { PrepareResult } from './generated/PrepareResult';
const pixel = Buffer.from('synthetic test pixels');
export const task: RecognitionTask = {
  schema_version: 'ava-recognition-task-1',
  task_id: 'task-page-1',
  purpose: 'pdf_region_recognition',
  source_sha256: 'a'.repeat(64),
  profile_id: 'ava-pdf-prose-en-v2',
  page_number: 1,
  page_width_pt: 612,
  page_height_pt: 792,
  region_box: {
    coordinate_space: 'page_points_top_left',
    x0: 0,
    y0: 0,
    x1: 612,
    y1: 792,
  },
  image: {
    media_type: 'image/png',
    sha256: createHash('sha256').update(pixel).digest('hex'),
    byte_length: pixel.length,
    width: 612,
    height: 792,
    base64: pixel.toString('base64'),
  },
  native_evidence: '',
  native_evidence_sha256: createHash('sha256').update('').digest('hex'),
  prompt_version: 'ava-prose-region-2',
  response_schema_version: 'ava-recognition-response-2',
};
export const prepared: PrepareResult = {
  schema_version: 'ava-prepare-result-1',
  source_sha256: task.source_sha256,
  source_page_count: 1,
  page_number: 1,
  observation_sha256: 'b'.repeat(64),
  native_segment_count: 0,
  tasks: [task],
};
export const response: RecognitionResponse = {
  schema_version: 'ava-recognition-response-2',
  task_id: task.task_id,
  source_sha256: task.source_sha256,
  render_sha256: task.image.sha256,
  segments: [],
  language: 'en',
  unresolved: [],
};
