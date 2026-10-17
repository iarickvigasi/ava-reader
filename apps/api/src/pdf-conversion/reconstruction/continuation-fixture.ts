// Authored blank-source control generated from the Python continuation fixture.
import type { PresentationRefinementTask } from './generated/PresentationRefinementTask';
import type { PresentationRefinementResponse } from './generated/PresentationRefinementResponse';
export const continuationTask: PresentationRefinementTask = {
  schema_version: 'ava-book-refinement-task-5',
  task_id:
    'refine-d539e75fc2f9d72d9b41e9b45b3b1498e11855264e80c2a14d7b942b5f26a0b3',
  source_sha256:
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  observation_sha256:
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  profile_id: 'ava-pdf-prose-en-v2',
  prompt_version: 'ava-book-refinement-8',
  response_schema_version: 'ava-book-refinement-response-5',
  nodes: [
    {
      id: 'left',
      page: 1,
      kind: 'paragraph',
      candidate_original_kind: null,
      structure_candidate: false,
      context_before: '',
      context_after: '',
      text_sha256:
        '360f84035942243c6a36537ae2f8673485e6c04455a0a85a0db19690f2541480',
      text_excerpt: 'left',
      observed_level: null,
      observed_chapter: false,
      observed_role: null,
      observed_style: {
        id: 'measured',
        family: 'serif',
        align: 'start',
        bold: false,
        italic: false,
        small_caps: false,
        vertical_align: 'baseline',
        relative_size: 1.0,
        indent_em: 1.1,
        space_before_em: 0.4,
        space_after_em: 5.329070518200751e-15,
        line_height: 1.2094999999999974,
        color: '#231f20',
      },
      ranked_source: true,
      body_reference_id: null,
    },
    {
      id: 'right',
      page: 2,
      kind: 'paragraph',
      candidate_original_kind: null,
      structure_candidate: false,
      context_before: '',
      context_after: '',
      text_sha256:
        '27042f4e6eca7d0b2a7ee4026df2ecfa51d3339e6d122aa099118ecd8563bad9',
      text_excerpt: 'right',
      observed_level: null,
      observed_chapter: false,
      observed_role: null,
      observed_style: {
        id: 'observed',
        family: 'serif',
        align: 'justify',
        bold: null,
        italic: null,
        small_caps: null,
        vertical_align: null,
        relative_size: null,
        indent_em: 0.0,
        block_indent_em: 0.0,
        space_before_em: null,
        space_after_em: 0.7,
        line_height: null,
        underline: false,
      },
      ranked_source: true,
      body_reference_id: null,
    },
  ],
  pixels_per_point: 2,
  decision_ids: ['right'],
  edges: [{ id: 'edge', previous_id: 'left', next_id: 'right' }],
  crops: [
    {
      id: 'crop-left',
      part: 'head',
      node_id: 'left',
      page: 1,
      source_box: {
        coordinate_space: 'page_points_top_left',
        x0: 0.0,
        y0: 0.0,
        x1: 10.0,
        y1: 10.0,
      },
      render_sha256:
        'df43710cdc7477a2e85a02cbdb383e85fbaf56e036e6fdd0f2c449be0fd00662',
      image_box: [0, 0, 20, 20],
    },
    {
      id: 'crop-right',
      part: 'head',
      node_id: 'right',
      page: 2,
      source_box: {
        coordinate_space: 'page_points_top_left',
        x0: 0.0,
        y0: 0.0,
        x1: 10.0,
        y1: 10.0,
      },
      render_sha256:
        'df43710cdc7477a2e85a02cbdb383e85fbaf56e036e6fdd0f2c449be0fd00662',
      image_box: [0, 20, 20, 40],
    },
  ],
  image: {
    media_type: 'image/png',
    sha256: 'df43710cdc7477a2e85a02cbdb383e85fbaf56e036e6fdd0f2c449be0fd00662',
    byte_length: 181,
    width: 64,
    height: 64,
    base64:
      'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfElEQVR4nNXOQREAIADDsFL/nocIHlyjIGcbZRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncRIncf4OvLpyqgN9ZSiDcwAAAABJRU5ErkJggg==',
  },
  native_endpoints: ['left'],
  native_alignment_fallbacks: ['left'],
  join_candidates: [
    {
      id: 'join-style-fb80b414ace3c64c85156272ca00d53175e9226b2c38be2dce86e529bc1436b0',
      edge_id: 'edge',
      previous_id: 'left',
      next_id: 'right',
      previous_text_sha256:
        '360f84035942243c6a36537ae2f8673485e6c04455a0a85a0db19690f2541480',
      next_text_sha256:
        '27042f4e6eca7d0b2a7ee4026df2ecfa51d3339e6d122aa099118ecd8563bad9',
      previous_style_sha256:
        '94425507f51ac29157724576315090e946ab8186be5f01e00cffd786e0b054bf',
      next_style_sha256:
        'fd1a3438497d94403237d444392401155cb3b234dc7fef345256285776401c71',
      native_id: 'left',
      native_alignment_fallback: true,
      previous_style: {
        id: 'measured',
        family: 'serif',
        align: 'justify',
        bold: false,
        italic: false,
        small_caps: false,
        vertical_align: 'baseline',
        relative_size: 1.0,
        indent_em: 1.1,
        block_indent_em: 0.0,
        space_before_em: 0.4,
        space_after_em: 0.7,
        line_height: 1.2094999999999974,
        color: '#231f20',
        underline: false,
      },
      next_style: {
        id: 'observed',
        family: 'serif',
        align: 'justify',
        bold: false,
        italic: false,
        small_caps: false,
        vertical_align: 'baseline',
        relative_size: 1.0,
        indent_em: 0.0,
        block_indent_em: 0.0,
        space_before_em: null,
        space_after_em: 0.7,
        line_height: 1.2094999999999974,
        color: '#231f20',
        underline: false,
      },
    },
  ],
};
export const continuationResponse: PresentationRefinementResponse = {
  schema_version: 'ava-book-refinement-response-5',
  task_id:
    'refine-d539e75fc2f9d72d9b41e9b45b3b1498e11855264e80c2a14d7b942b5f26a0b3',
  source_sha256:
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  observation_sha256:
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  image_sha256:
    'df43710cdc7477a2e85a02cbdb383e85fbaf56e036e6fdd0f2c449be0fd00662',
  decisions: [
    {
      node_id: 'right',
      text_sha256:
        '27042f4e6eca7d0b2a7ee4026df2ecfa51d3339e6d122aa099118ecd8563bad9',
      evidence_ids: ['crop-right'],
      heading_level: null,
      parent_id: null,
      chapter_start: null,
      chapter_role: null,
      role_kind: null,
      style: null,
    },
  ],
  joins: [
    { edge_id: 'edge', join: true, evidence_ids: ['crop-left', 'crop-right'] },
  ],
  unresolved: [],
  presentations: [
    {
      edge_id: 'edge',
      candidate_id:
        'join-style-fb80b414ace3c64c85156272ca00d53175e9226b2c38be2dce86e529bc1436b0',
      evidence_ids: ['crop-left', 'crop-right'],
    },
  ],
};
