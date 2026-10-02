import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import { task as pageTask } from './test-fixture';
export const refinementTask: BookRefinementTask = {
  schema_version: 'ava-book-refinement-task-3',
  task_id: 'refine-test',
  source_sha256: pageTask.source_sha256,
  observation_sha256: 'b'.repeat(64),
  profile_id: 'ava-pdf-prose-en-v2',
  prompt_version: 'ava-book-refinement-3',
  response_schema_version: 'ava-book-refinement-response-3',
  pixels_per_point: 2,
  nodes: [
    {
      id: 'heading',
      page: 1,
      kind: 'heading',
      text_sha256: 'c'.repeat(64),
      text_excerpt: 'Chapter One',
      observed_level: 1,
      observed_chapter: true,
      observed_role: 'bodymatter',
      observed_style: null,
      ranked_source: false,
      body_reference_id: null,
    },
  ],
  decision_ids: ['heading'],
  edges: [],
  image: pageTask.image,
  crops: [
    {
      id: 'crop-heading',
      part: 'head',
      node_id: 'heading',
      page: 1,
      source_box: {
        coordinate_space: 'page_points_top_left',
        x0: 0,
        y0: 0,
        x1: 1,
        y1: 1,
      },
      render_sha256: pageTask.image.sha256,
      image_box: [0, 0, 1, 1],
    },
  ],
};
export const refinementResponse: BookRefinementResponse = {
  schema_version: 'ava-book-refinement-response-3',
  task_id: refinementTask.task_id,
  source_sha256: refinementTask.source_sha256,
  observation_sha256: refinementTask.observation_sha256,
  image_sha256: refinementTask.image.sha256,
  decisions: [
    {
      node_id: 'heading',
      text_sha256: 'c'.repeat(64),
      evidence_ids: ['crop-heading'],
      heading_level: 1,
      parent_id: null,
      chapter_start: true,
      chapter_role: 'bodymatter',
      style: { id: 'observed', relative_size: 2, bold: false },
    },
  ],
  joins: [],
  unresolved: [],
};
