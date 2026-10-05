/* Generated; do not edit. */
export const recognitionSchemas = {
  BookRefinementResponse: {
    $defs: {
      BibliographicDecision: {
        additionalProperties: false,
        properties: {
          end: {
            anyOf: [
              { exclusiveMinimum: 0, maximum: 500, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'End',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Evidence Ids',
            type: 'array',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          role: {
            anyOf: [
              {
                enum: [
                  'author',
                  'translator',
                  'editor',
                  'illustrator',
                  'subtitle',
                  'publisher',
                ],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Role',
          },
          start: {
            anyOf: [
              { maximum: 500, minimum: 0, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'Start',
          },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: ['node_id', 'text_sha256', 'evidence_ids', 'role'],
        title: 'BibliographicDecision',
        type: 'object',
      },
      NativeRefinementDecision: {
        additionalProperties: false,
        properties: {
          chapter_role: {
            anyOf: [
              {
                enum: ['frontmatter', 'bodymatter', 'backmatter'],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Chapter Role',
          },
          chapter_start: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            title: 'Chapter Start',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Evidence Ids',
            type: 'array',
          },
          heading_level: {
            anyOf: [
              { maximum: 6, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            title: 'Heading Level',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          parent_id: {
            anyOf: [
              {
                maxLength: 120,
                pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Parent Id',
          },
          role_kind: {
            enum: ['heading', 'paragraph', 'list_item', 'verse', 'quote'],
            title: 'Role Kind',
            type: 'string',
          },
          style: { title: 'Style', type: 'null' },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: [
          'node_id',
          'text_sha256',
          'evidence_ids',
          'heading_level',
          'parent_id',
          'chapter_start',
          'chapter_role',
          'role_kind',
          'style',
        ],
        title: 'NativeRefinementDecision',
        type: 'object',
      },
      OcrRefinementDecision: {
        additionalProperties: false,
        properties: {
          chapter_role: {
            anyOf: [
              {
                enum: ['frontmatter', 'bodymatter', 'backmatter'],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Chapter Role',
          },
          chapter_start: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            title: 'Chapter Start',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Evidence Ids',
            type: 'array',
          },
          heading_level: {
            anyOf: [
              { maximum: 6, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            title: 'Heading Level',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          parent_id: {
            anyOf: [
              {
                maxLength: 120,
                pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Parent Id',
          },
          role_kind: { default: null, title: 'Role Kind', type: 'null' },
          style: { $ref: '#/$defs/RefinementStyle' },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: [
          'node_id',
          'text_sha256',
          'evidence_ids',
          'heading_level',
          'parent_id',
          'chapter_start',
          'chapter_role',
          'style',
        ],
        title: 'OcrRefinementDecision',
        type: 'object',
      },
      RefinementJoin: {
        additionalProperties: false,
        properties: {
          edge_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Edge Id',
            type: 'string',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 2,
            title: 'Evidence Ids',
            type: 'array',
          },
          join: { title: 'Join', type: 'boolean' },
        },
        required: ['edge_id', 'join', 'evidence_ids'],
        title: 'RefinementJoin',
        type: 'object',
      },
      RefinementStyle: {
        additionalProperties: false,
        description:
          'Sparse source typography with the wire observations required by acceptance.',
        properties: {
          align: {
            anyOf: [
              {
                enum: ['start', 'left', 'right', 'center', 'justify'],
                type: 'string',
              },
              { type: 'null' },
            ],
            default: null,
            title: 'Align',
          },
          background_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Background Color',
          },
          block_indent_em: {
            anyOf: [
              { maximum: 6, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Block Indent Em',
          },
          bold: { title: 'Bold', type: 'boolean' },
          color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Color',
          },
          decoration_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Decoration Color',
          },
          family: {
            anyOf: [
              { enum: ['serif', 'sans-serif', 'monospace'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Family',
          },
          id: { const: 'observed', title: 'Id', type: 'string' },
          indent_em: {
            anyOf: [
              { maximum: 6, minimum: -3, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Indent Em',
          },
          italic: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Italic',
          },
          line_height: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Line Height',
          },
          relative_size: {
            maximum: 3,
            minimum: 0.5,
            title: 'Relative Size',
            type: 'number',
          },
          small_caps: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Small Caps',
          },
          space_after_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space After Em',
          },
          space_before_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space Before Em',
          },
          strike_through: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Strike Through',
          },
          underline: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Underline',
          },
          vertical_align: {
            anyOf: [
              { enum: ['baseline', 'super', 'sub'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Vertical Align',
          },
        },
        required: ['id', 'bold', 'relative_size'],
        title: 'RefinementStyle',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      decisions: {
        items: {
          anyOf: [
            { $ref: '#/$defs/NativeRefinementDecision' },
            { $ref: '#/$defs/OcrRefinementDecision' },
          ],
        },
        maxItems: 24,
        title: 'Decisions',
        type: 'array',
      },
      image_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Image Sha256',
        type: 'string',
      },
      joins: {
        items: { $ref: '#/$defs/RefinementJoin' },
        maxItems: 16,
        title: 'Joins',
        type: 'array',
      },
      metadata_decisions: {
        items: { $ref: '#/$defs/BibliographicDecision' },
        maxItems: 24,
        title: 'Metadata Decisions',
        type: 'array',
      },
      observation_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Observation Sha256',
        type: 'string',
      },
      schema_version: {
        const: 'ava-book-refinement-response-3',
        title: 'Schema Version',
        type: 'string',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
      task_id: {
        maxLength: 120,
        pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
        title: 'Task Id',
        type: 'string',
      },
      unresolved: {
        items: { type: 'string' },
        maxItems: 100,
        title: 'Unresolved',
        type: 'array',
      },
    },
    required: [
      'schema_version',
      'task_id',
      'source_sha256',
      'observation_sha256',
      'image_sha256',
      'decisions',
      'joins',
      'unresolved',
    ],
    title: 'BookRefinementResponse',
    type: 'object',
  },
  BookRefinementTask: {
    $defs: {
      Box: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            enum: ['page_points_top_left', 'normalized_top_left'],
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: { maximum: 20000, minimum: 0, title: 'X0', type: 'number' },
          x1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'X1',
            type: 'number',
          },
          y0: { maximum: 20000, minimum: 0, title: 'Y0', type: 'number' },
          y1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'Box',
        type: 'object',
      },
      RecognitionImage: {
        additionalProperties: false,
        properties: {
          base64: {
            maxLength: 22369624,
            minLength: 4,
            title: 'Base64',
            type: 'string',
          },
          byte_length: {
            maximum: 16777216,
            minimum: 1,
            title: 'Byte Length',
            type: 'integer',
          },
          height: {
            maximum: 6000,
            minimum: 1,
            title: 'Height',
            type: 'integer',
          },
          media_type: {
            enum: ['image/png', 'image/jpeg'],
            title: 'Media Type',
            type: 'string',
          },
          sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Sha256',
            type: 'string',
          },
          width: { maximum: 6000, minimum: 1, title: 'Width', type: 'integer' },
        },
        required: [
          'media_type',
          'sha256',
          'byte_length',
          'width',
          'height',
          'base64',
        ],
        title: 'RecognitionImage',
        type: 'object',
      },
      RefinementCrop: {
        additionalProperties: false,
        properties: {
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          image_box: {
            items: { type: 'integer' },
            maxItems: 4,
            minItems: 4,
            title: 'Image Box',
            type: 'array',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          page: { maximum: 500, minimum: 1, title: 'Page', type: 'integer' },
          part: { enum: ['head', 'tail'], title: 'Part', type: 'string' },
          render_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Render Sha256',
            type: 'string',
          },
          source_box: { $ref: '#/$defs/Box' },
        },
        required: [
          'id',
          'part',
          'node_id',
          'page',
          'source_box',
          'render_sha256',
          'image_box',
        ],
        title: 'RefinementCrop',
        type: 'object',
      },
      RefinementEdge: {
        additionalProperties: false,
        properties: {
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          next_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Next Id',
            type: 'string',
          },
          previous_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Previous Id',
            type: 'string',
          },
        },
        required: ['id', 'previous_id', 'next_id'],
        title: 'RefinementEdge',
        type: 'object',
      },
      RefinementNode: {
        additionalProperties: false,
        properties: {
          body_reference_id: {
            anyOf: [
              {
                maxLength: 120,
                pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Body Reference Id',
          },
          candidate_original_kind: {
            anyOf: [
              { enum: ['paragraph', 'list_item', 'verse'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Candidate Original Kind',
          },
          context_after: {
            default: '',
            maxLength: 200,
            title: 'Context After',
            type: 'string',
          },
          context_before: {
            default: '',
            maxLength: 200,
            title: 'Context Before',
            type: 'string',
          },
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          kind: {
            enum: ['heading', 'paragraph'],
            title: 'Kind',
            type: 'string',
          },
          observed_chapter: { title: 'Observed Chapter', type: 'boolean' },
          observed_level: {
            anyOf: [
              { maximum: 6, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            title: 'Observed Level',
          },
          observed_role: {
            anyOf: [
              {
                enum: ['frontmatter', 'bodymatter', 'backmatter'],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Observed Role',
          },
          observed_style: {
            anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }],
          },
          page: { maximum: 500, minimum: 1, title: 'Page', type: 'integer' },
          ranked_source: { title: 'Ranked Source', type: 'boolean' },
          structure_candidate: {
            default: false,
            title: 'Structure Candidate',
            type: 'boolean',
          },
          text_excerpt: {
            maxLength: 500,
            title: 'Text Excerpt',
            type: 'string',
          },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: [
          'id',
          'page',
          'kind',
          'text_sha256',
          'text_excerpt',
          'observed_level',
          'observed_chapter',
          'observed_role',
          'observed_style',
          'ranked_source',
          'body_reference_id',
        ],
        title: 'RefinementNode',
        type: 'object',
      },
      Style: {
        additionalProperties: false,
        properties: {
          align: {
            anyOf: [
              {
                enum: ['start', 'left', 'right', 'center', 'justify'],
                type: 'string',
              },
              { type: 'null' },
            ],
            default: null,
            title: 'Align',
          },
          background_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Background Color',
          },
          block_indent_em: {
            anyOf: [
              { maximum: 6, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Block Indent Em',
          },
          bold: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Bold',
          },
          color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Color',
          },
          decoration_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Decoration Color',
          },
          family: {
            anyOf: [
              { enum: ['serif', 'sans-serif', 'monospace'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Family',
          },
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          indent_em: {
            anyOf: [
              { maximum: 6, minimum: -3, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Indent Em',
          },
          italic: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Italic',
          },
          line_height: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Line Height',
          },
          relative_size: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Relative Size',
          },
          small_caps: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Small Caps',
          },
          space_after_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space After Em',
          },
          space_before_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space Before Em',
          },
          strike_through: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Strike Through',
          },
          underline: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Underline',
          },
          vertical_align: {
            anyOf: [
              { enum: ['baseline', 'super', 'sub'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Vertical Align',
          },
        },
        required: ['id'],
        title: 'Style',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      crops: {
        items: { $ref: '#/$defs/RefinementCrop' },
        maxItems: 48,
        minItems: 1,
        title: 'Crops',
        type: 'array',
      },
      decision_ids: {
        items: {
          maxLength: 120,
          pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
          type: 'string',
        },
        maxItems: 24,
        title: 'Decision Ids',
        type: 'array',
      },
      edges: {
        items: { $ref: '#/$defs/RefinementEdge' },
        maxItems: 16,
        title: 'Edges',
        type: 'array',
      },
      image: { $ref: '#/$defs/RecognitionImage' },
      metadata_ids: {
        items: {
          maxLength: 120,
          pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
          type: 'string',
        },
        maxItems: 24,
        title: 'Metadata Ids',
        type: 'array',
      },
      nodes: {
        items: { $ref: '#/$defs/RefinementNode' },
        maxItems: 256,
        minItems: 1,
        title: 'Nodes',
        type: 'array',
      },
      observation_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Observation Sha256',
        type: 'string',
      },
      pixels_per_point: {
        const: 2,
        title: 'Pixels Per Point',
        type: 'integer',
      },
      profile_id: {
        enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
        title: 'Profile Id',
        type: 'string',
      },
      prompt_version: {
        enum: [
          'ava-book-refinement-3',
          'ava-book-refinement-4',
          'ava-book-refinement-5',
        ],
        title: 'Prompt Version',
        type: 'string',
      },
      response_schema_version: {
        const: 'ava-book-refinement-response-3',
        title: 'Response Schema Version',
        type: 'string',
      },
      schema_version: {
        const: 'ava-book-refinement-task-3',
        title: 'Schema Version',
        type: 'string',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
      task_id: {
        maxLength: 120,
        pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
        title: 'Task Id',
        type: 'string',
      },
    },
    required: [
      'schema_version',
      'task_id',
      'source_sha256',
      'observation_sha256',
      'profile_id',
      'prompt_version',
      'response_schema_version',
      'nodes',
      'pixels_per_point',
      'decision_ids',
      'edges',
      'crops',
      'image',
    ],
    title: 'BookRefinementTask',
    type: 'object',
  },
  PrepareResult: {
    $defs: {
      Box: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            enum: ['page_points_top_left', 'normalized_top_left'],
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: { maximum: 20000, minimum: 0, title: 'X0', type: 'number' },
          x1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'X1',
            type: 'number',
          },
          y0: { maximum: 20000, minimum: 0, title: 'Y0', type: 'number' },
          y1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'Box',
        type: 'object',
      },
      RecognitionImage: {
        additionalProperties: false,
        properties: {
          base64: {
            maxLength: 22369624,
            minLength: 4,
            title: 'Base64',
            type: 'string',
          },
          byte_length: {
            maximum: 16777216,
            minimum: 1,
            title: 'Byte Length',
            type: 'integer',
          },
          height: {
            maximum: 6000,
            minimum: 1,
            title: 'Height',
            type: 'integer',
          },
          media_type: {
            enum: ['image/png', 'image/jpeg'],
            title: 'Media Type',
            type: 'string',
          },
          sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Sha256',
            type: 'string',
          },
          width: { maximum: 6000, minimum: 1, title: 'Width', type: 'integer' },
        },
        required: [
          'media_type',
          'sha256',
          'byte_length',
          'width',
          'height',
          'base64',
        ],
        title: 'RecognitionImage',
        type: 'object',
      },
      RecognitionTask: {
        additionalProperties: false,
        properties: {
          image: { $ref: '#/$defs/RecognitionImage' },
          native_evidence: {
            maxLength: 200000,
            title: 'Native Evidence',
            type: 'string',
          },
          native_evidence_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Native Evidence Sha256',
            type: 'string',
          },
          page_height_pt: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Page Height Pt',
            type: 'number',
          },
          page_number: {
            maximum: 500,
            minimum: 1,
            title: 'Page Number',
            type: 'integer',
          },
          page_width_pt: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Page Width Pt',
            type: 'number',
          },
          profile_id: {
            enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
            title: 'Profile Id',
            type: 'string',
          },
          prompt_version: {
            enum: [
              'ava-prose-region-2',
              'ava-prose-region-3',
              'ava-prose-region-4',
              'ava-prose-region-5',
              'ava-prose-region-6',
              'ava-prose-region-7',
              'ava-prose-region-8',
              'ava-prose-region-9',
              'ava-prose-region-10',
              'ava-prose-region-11',
              'ava-prose-region-12',
              'ava-prose-region-13',
              'ava-prose-region-14',
            ],
            title: 'Prompt Version',
            type: 'string',
          },
          purpose: {
            enum: ['pdf_region_recognition', 'pdf_structure_repair'],
            title: 'Purpose',
            type: 'string',
          },
          region_box: { $ref: '#/$defs/Box' },
          response_schema_version: {
            const: 'ava-recognition-response-2',
            title: 'Response Schema Version',
            type: 'string',
          },
          schema_version: {
            const: 'ava-recognition-task-1',
            title: 'Schema Version',
            type: 'string',
          },
          source_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Source Sha256',
            type: 'string',
          },
          task_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Task Id',
            type: 'string',
          },
        },
        required: [
          'schema_version',
          'task_id',
          'purpose',
          'source_sha256',
          'profile_id',
          'page_number',
          'page_width_pt',
          'page_height_pt',
          'region_box',
          'image',
          'native_evidence',
          'native_evidence_sha256',
          'prompt_version',
          'response_schema_version',
        ],
        title: 'RecognitionTask',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      native_segment_count: {
        maximum: 2000,
        minimum: 0,
        title: 'Native Segment Count',
        type: 'integer',
      },
      observation_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Observation Sha256',
        type: 'string',
      },
      page_number: {
        maximum: 500,
        minimum: 1,
        title: 'Page Number',
        type: 'integer',
      },
      profile_id: {
        default: 'ava-pdf-prose-en-v2',
        enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
        title: 'Profile Id',
        type: 'string',
      },
      schema_version: {
        const: 'ava-prepare-result-1',
        title: 'Schema Version',
        type: 'string',
      },
      source_page_count: {
        maximum: 500,
        minimum: 1,
        title: 'Source Page Count',
        type: 'integer',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
      tasks: {
        items: { $ref: '#/$defs/RecognitionTask' },
        maxItems: 50,
        title: 'Tasks',
        type: 'array',
      },
    },
    required: [
      'schema_version',
      'source_sha256',
      'source_page_count',
      'page_number',
      'observation_sha256',
      'native_segment_count',
      'tasks',
    ],
    title: 'PrepareResult',
    type: 'object',
  },
  RecognitionResponse: {
    $defs: {
      RecognitionBox: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            const: 'render_normalized_1000',
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: {
            exclusiveMaximum: 1000,
            minimum: 0,
            title: 'X0',
            type: 'number',
          },
          x1: {
            exclusiveMinimum: 0,
            maximum: 1000,
            title: 'X1',
            type: 'number',
          },
          y0: {
            exclusiveMaximum: 1000,
            minimum: 0,
            title: 'Y0',
            type: 'number',
          },
          y1: {
            exclusiveMinimum: 0,
            maximum: 1000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'RecognitionBox',
        type: 'object',
      },
      RecognitionCell: {
        additionalProperties: false,
        properties: {
          box: {
            anyOf: [{ $ref: '#/$defs/RecognitionBox' }, { type: 'null' }],
          },
          column_span: {
            default: 1,
            maximum: 8,
            minimum: 1,
            title: 'Column Span',
            type: 'integer',
          },
          header_axis: {
            anyOf: [
              { enum: ['row', 'column', 'both'], type: 'string' },
              { type: 'null' },
            ],
            title: 'Header Axis',
          },
          row_span: {
            default: 1,
            maximum: 20,
            minimum: 1,
            title: 'Row Span',
            type: 'integer',
          },
          source_cell_id: {
            anyOf: [
              { maxLength: 120, minLength: 1, type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Source Cell Id',
          },
          spans: {
            items: { $ref: '#/$defs/RecognitionSpan' },
            maxItems: 20000,
            title: 'Spans',
            type: 'array',
          },
          style: { anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }] },
          text: { maxLength: 200000, title: 'Text', type: 'string' },
        },
        required: ['text', 'box', 'style', 'header_axis', 'spans'],
        title: 'RecognitionCell',
        type: 'object',
      },
      RecognitionSegment: {
        allOf: [
          {
            additionalProperties: false,
            properties: {
              alt: {
                default: '',
                maxLength: 4000,
                title: 'Alt',
                type: 'string',
              },
              box: { $ref: '#/$defs/RecognitionBox' },
              cells: {
                items: {
                  items: { $ref: '#/$defs/RecognitionCell' },
                  type: 'array',
                },
                maxItems: 20,
                title: 'Cells',
                type: 'array',
              },
              chapter_role: {
                anyOf: [
                  {
                    enum: ['frontmatter', 'bodymatter', 'backmatter'],
                    type: 'string',
                  },
                  { type: 'null' },
                ],
                default: null,
                title: 'Chapter Role',
              },
              chapter_start: {
                default: false,
                title: 'Chapter Start',
                type: 'boolean',
              },
              continues_from_previous: {
                title: 'Continues From Previous',
                type: 'boolean',
              },
              continues_to_next: {
                title: 'Continues To Next',
                type: 'boolean',
              },
              heading_level: {
                anyOf: [
                  { maximum: 6, minimum: 1, type: 'integer' },
                  { type: 'null' },
                ],
                default: null,
                title: 'Heading Level',
              },
              id: {
                description: 'Unique within this response; s0001, s0002, ...',
                maxLength: 120,
                minLength: 1,
                title: 'Id',
                type: 'string',
              },
              kind: {
                enum: [
                  'paragraph',
                  'heading',
                  'quote',
                  'aside',
                  'caption',
                  'credit',
                  'verse',
                  'code',
                  'list_item',
                  'note',
                  'figure',
                  'table',
                  'separator',
                  'furniture',
                  'unsupported',
                ],
                title: 'Kind',
                type: 'string',
              },
              list_depth: {
                anyOf: [
                  { maximum: 3, minimum: 1, type: 'integer' },
                  { type: 'null' },
                ],
                default: null,
                title: 'List Depth',
              },
              list_ordered: {
                anyOf: [{ type: 'boolean' }, { type: 'null' }],
                default: null,
                title: 'List Ordered',
              },
              list_start: {
                anyOf: [
                  { maximum: 1000000, minimum: 0, type: 'integer' },
                  { type: 'null' },
                ],
                default: null,
                title: 'List Start',
              },
              method: { const: 'ocr', title: 'Method', type: 'string' },
              note_label: {
                anyOf: [{ maxLength: 100, type: 'string' }, { type: 'null' }],
                default: null,
                title: 'Note Label',
              },
              note_role: {
                anyOf: [
                  { enum: ['footnote', 'endnote'], type: 'string' },
                  { type: 'null' },
                ],
                default: null,
                title: 'Note Role',
              },
              page: {
                maximum: 500,
                minimum: 1,
                title: 'Page',
                type: 'integer',
              },
              related_to: {
                anyOf: [{ maxLength: 120, type: 'string' }, { type: 'null' }],
                default: null,
                title: 'Related To',
              },
              spans: {
                items: { $ref: '#/$defs/RecognitionSpan' },
                maxItems: 20000,
                title: 'Spans',
                type: 'array',
              },
              style: { anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }] },
              text: { maxLength: 200000, title: 'Text', type: 'string' },
            },
            required: [
              'id',
              'page',
              'box',
              'kind',
              'text',
              'style',
              'spans',
              'method',
              'continues_from_previous',
              'continues_to_next',
            ],
            title: 'RecognitionSegment',
            type: 'object',
          },
          {
            anyOf: [
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  heading_level: { maximum: 6, minimum: 1, type: 'integer' },
                  kind: { enum: ['heading'] },
                },
                required: ['chapter_start', 'heading_level'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['note'] },
                  note_label: { minLength: 1, type: 'string' },
                  note_role: { enum: ['footnote', 'endnote'] },
                },
                required: ['note_label', 'note_role'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['list_item'] },
                  list_depth: { maximum: 3, minimum: 1, type: 'integer' },
                  list_ordered: { type: 'boolean' },
                },
                required: ['list_depth', 'list_ordered'],
                type: 'object',
              },
              {
                properties: {
                  cells: {
                    items: { maxItems: 8, minItems: 0, type: 'array' },
                    minItems: 1,
                    type: 'array',
                  },
                  kind: { enum: ['table'] },
                },
                required: ['cells'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['paragraph'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['quote'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['aside'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['caption'] },
                },
                required: ['related_to'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['credit'] },
                },
                required: ['related_to'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['verse'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['code'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['figure'] },
                },
                required: ['alt'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['separator'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['furniture'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['unsupported'] },
                },
                required: [],
                type: 'object',
              },
            ],
          },
          {
            anyOf: [
              {
                properties: { chapter_start: { const: false } },
                type: 'object',
              },
              {
                properties: {
                  chapter_role: {
                    enum: ['frontmatter', 'bodymatter', 'backmatter'],
                  },
                  chapter_start: { const: true },
                  heading_level: { const: 1 },
                  kind: { enum: ['heading'] },
                },
                required: ['chapter_role', 'chapter_start', 'heading_level'],
                type: 'object',
              },
            ],
          },
          {
            anyOf: [
              {
                properties: { list_ordered: { enum: [null, false] } },
                type: 'object',
              },
              {
                properties: {
                  kind: { enum: ['list_item'] },
                  list_ordered: { const: true },
                  list_start: { maximum: 1000000, minimum: 0, type: 'integer' },
                },
                required: ['list_depth', 'list_ordered', 'list_start'],
                type: 'object',
              },
            ],
          },
        ],
      },
      RecognitionSpan: {
        additionalProperties: false,
        properties: {
          anchor: {
            anyOf: [
              { $ref: '#/$defs/RecognitionTextAnchor' },
              { type: 'null' },
            ],
            default: null,
          },
          end: {
            anyOf: [
              { exclusiveMinimum: 0, maximum: 200000, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'End',
          },
          note_label: {
            anyOf: [{ maxLength: 100, type: 'string' }, { type: 'null' }],
            title: 'Note Label',
          },
          start: {
            anyOf: [
              { maximum: 200000, minimum: 0, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'Start',
          },
          style: { anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }] },
          target_text: {
            anyOf: [{ maxLength: 1000, type: 'string' }, { type: 'null' }],
            title: 'Target Text',
          },
          url: {
            anyOf: [{ maxLength: 2048, type: 'string' }, { type: 'null' }],
            title: 'Url',
          },
        },
        required: ['style', 'note_label', 'target_text', 'url'],
        title: 'RecognitionSpan',
        type: 'object',
      },
      RecognitionTextAnchor: {
        additionalProperties: false,
        properties: {
          after: {
            default: '',
            maxLength: 128,
            title: 'After',
            type: 'string',
          },
          before: {
            default: '',
            maxLength: 128,
            title: 'Before',
            type: 'string',
          },
          exact_text: {
            maxLength: 1000,
            minLength: 1,
            title: 'Exact Text',
            type: 'string',
          },
        },
        required: ['exact_text'],
        title: 'RecognitionTextAnchor',
        type: 'object',
      },
      Style: {
        additionalProperties: false,
        properties: {
          align: {
            anyOf: [
              {
                enum: ['start', 'left', 'right', 'center', 'justify'],
                type: 'string',
              },
              { type: 'null' },
            ],
            default: null,
            title: 'Align',
          },
          background_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Background Color',
          },
          block_indent_em: {
            anyOf: [
              { maximum: 6, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Block Indent Em',
          },
          bold: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Bold',
          },
          color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Color',
          },
          decoration_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Decoration Color',
          },
          family: {
            anyOf: [
              { enum: ['serif', 'sans-serif', 'monospace'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Family',
          },
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          indent_em: {
            anyOf: [
              { maximum: 6, minimum: -3, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Indent Em',
          },
          italic: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Italic',
          },
          line_height: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Line Height',
          },
          relative_size: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Relative Size',
          },
          small_caps: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Small Caps',
          },
          space_after_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space After Em',
          },
          space_before_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space Before Em',
          },
          strike_through: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Strike Through',
          },
          underline: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Underline',
          },
          vertical_align: {
            anyOf: [
              { enum: ['baseline', 'super', 'sub'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Vertical Align',
          },
        },
        required: ['id'],
        title: 'Style',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      language: {
        maxLength: 50,
        minLength: 1,
        title: 'Language',
        type: 'string',
      },
      render_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Render Sha256',
        type: 'string',
      },
      schema_version: {
        const: 'ava-recognition-response-2',
        title: 'Schema Version',
        type: 'string',
      },
      segments: {
        items: { $ref: '#/$defs/RecognitionSegment' },
        maxItems: 2000,
        title: 'Segments',
        type: 'array',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
      task_id: {
        maxLength: 120,
        pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
        title: 'Task Id',
        type: 'string',
      },
      unresolved: {
        items: { type: 'string' },
        maxItems: 100,
        title: 'Unresolved',
        type: 'array',
      },
    },
    required: [
      'schema_version',
      'task_id',
      'source_sha256',
      'render_sha256',
      'segments',
      'unresolved',
      'language',
    ],
    title: 'RecognitionResponse',
    type: 'object',
  },
  RecognitionTask: {
    $defs: {
      Box: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            enum: ['page_points_top_left', 'normalized_top_left'],
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: { maximum: 20000, minimum: 0, title: 'X0', type: 'number' },
          x1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'X1',
            type: 'number',
          },
          y0: { maximum: 20000, minimum: 0, title: 'Y0', type: 'number' },
          y1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'Box',
        type: 'object',
      },
      RecognitionImage: {
        additionalProperties: false,
        properties: {
          base64: {
            maxLength: 22369624,
            minLength: 4,
            title: 'Base64',
            type: 'string',
          },
          byte_length: {
            maximum: 16777216,
            minimum: 1,
            title: 'Byte Length',
            type: 'integer',
          },
          height: {
            maximum: 6000,
            minimum: 1,
            title: 'Height',
            type: 'integer',
          },
          media_type: {
            enum: ['image/png', 'image/jpeg'],
            title: 'Media Type',
            type: 'string',
          },
          sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Sha256',
            type: 'string',
          },
          width: { maximum: 6000, minimum: 1, title: 'Width', type: 'integer' },
        },
        required: [
          'media_type',
          'sha256',
          'byte_length',
          'width',
          'height',
          'base64',
        ],
        title: 'RecognitionImage',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      image: { $ref: '#/$defs/RecognitionImage' },
      native_evidence: {
        maxLength: 200000,
        title: 'Native Evidence',
        type: 'string',
      },
      native_evidence_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Native Evidence Sha256',
        type: 'string',
      },
      page_height_pt: {
        exclusiveMinimum: 0,
        maximum: 20000,
        title: 'Page Height Pt',
        type: 'number',
      },
      page_number: {
        maximum: 500,
        minimum: 1,
        title: 'Page Number',
        type: 'integer',
      },
      page_width_pt: {
        exclusiveMinimum: 0,
        maximum: 20000,
        title: 'Page Width Pt',
        type: 'number',
      },
      profile_id: {
        enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
        title: 'Profile Id',
        type: 'string',
      },
      prompt_version: {
        enum: [
          'ava-prose-region-2',
          'ava-prose-region-3',
          'ava-prose-region-4',
          'ava-prose-region-5',
          'ava-prose-region-6',
          'ava-prose-region-7',
          'ava-prose-region-8',
          'ava-prose-region-9',
          'ava-prose-region-10',
          'ava-prose-region-11',
          'ava-prose-region-12',
          'ava-prose-region-13',
          'ava-prose-region-14',
        ],
        title: 'Prompt Version',
        type: 'string',
      },
      purpose: {
        enum: ['pdf_region_recognition', 'pdf_structure_repair'],
        title: 'Purpose',
        type: 'string',
      },
      region_box: { $ref: '#/$defs/Box' },
      response_schema_version: {
        const: 'ava-recognition-response-2',
        title: 'Response Schema Version',
        type: 'string',
      },
      schema_version: {
        const: 'ava-recognition-task-1',
        title: 'Schema Version',
        type: 'string',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
      task_id: {
        maxLength: 120,
        pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
        title: 'Task Id',
        type: 'string',
      },
    },
    required: [
      'schema_version',
      'task_id',
      'purpose',
      'source_sha256',
      'profile_id',
      'page_number',
      'page_width_pt',
      'page_height_pt',
      'region_box',
      'image',
      'native_evidence',
      'native_evidence_sha256',
      'prompt_version',
      'response_schema_version',
    ],
    title: 'RecognitionTask',
    type: 'object',
  },
  ReconstructionInput: {
    $defs: {
      BibliographicDecision: {
        additionalProperties: false,
        properties: {
          end: {
            anyOf: [
              { exclusiveMinimum: 0, maximum: 500, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'End',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Evidence Ids',
            type: 'array',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          role: {
            anyOf: [
              {
                enum: [
                  'author',
                  'translator',
                  'editor',
                  'illustrator',
                  'subtitle',
                  'publisher',
                ],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Role',
          },
          start: {
            anyOf: [
              { maximum: 500, minimum: 0, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'Start',
          },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: ['node_id', 'text_sha256', 'evidence_ids', 'role'],
        title: 'BibliographicDecision',
        type: 'object',
      },
      BookRefinementResponse: {
        additionalProperties: false,
        properties: {
          decisions: {
            items: {
              anyOf: [
                { $ref: '#/$defs/NativeRefinementDecision' },
                { $ref: '#/$defs/OcrRefinementDecision' },
              ],
            },
            maxItems: 24,
            title: 'Decisions',
            type: 'array',
          },
          image_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Image Sha256',
            type: 'string',
          },
          joins: {
            items: { $ref: '#/$defs/RefinementJoin' },
            maxItems: 16,
            title: 'Joins',
            type: 'array',
          },
          metadata_decisions: {
            items: { $ref: '#/$defs/BibliographicDecision' },
            maxItems: 24,
            title: 'Metadata Decisions',
            type: 'array',
          },
          observation_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Observation Sha256',
            type: 'string',
          },
          schema_version: {
            const: 'ava-book-refinement-response-3',
            title: 'Schema Version',
            type: 'string',
          },
          source_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Source Sha256',
            type: 'string',
          },
          task_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Task Id',
            type: 'string',
          },
          unresolved: {
            items: { type: 'string' },
            maxItems: 100,
            title: 'Unresolved',
            type: 'array',
          },
        },
        required: [
          'schema_version',
          'task_id',
          'source_sha256',
          'observation_sha256',
          'image_sha256',
          'decisions',
          'joins',
          'unresolved',
        ],
        title: 'BookRefinementResponse',
        type: 'object',
      },
      NativeRefinementDecision: {
        additionalProperties: false,
        properties: {
          chapter_role: {
            anyOf: [
              {
                enum: ['frontmatter', 'bodymatter', 'backmatter'],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Chapter Role',
          },
          chapter_start: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            title: 'Chapter Start',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Evidence Ids',
            type: 'array',
          },
          heading_level: {
            anyOf: [
              { maximum: 6, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            title: 'Heading Level',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          parent_id: {
            anyOf: [
              {
                maxLength: 120,
                pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Parent Id',
          },
          role_kind: {
            enum: ['heading', 'paragraph', 'list_item', 'verse', 'quote'],
            title: 'Role Kind',
            type: 'string',
          },
          style: { title: 'Style', type: 'null' },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: [
          'node_id',
          'text_sha256',
          'evidence_ids',
          'heading_level',
          'parent_id',
          'chapter_start',
          'chapter_role',
          'role_kind',
          'style',
        ],
        title: 'NativeRefinementDecision',
        type: 'object',
      },
      OcrRefinementDecision: {
        additionalProperties: false,
        properties: {
          chapter_role: {
            anyOf: [
              {
                enum: ['frontmatter', 'bodymatter', 'backmatter'],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Chapter Role',
          },
          chapter_start: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            title: 'Chapter Start',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Evidence Ids',
            type: 'array',
          },
          heading_level: {
            anyOf: [
              { maximum: 6, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            title: 'Heading Level',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          parent_id: {
            anyOf: [
              {
                maxLength: 120,
                pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Parent Id',
          },
          role_kind: { default: null, title: 'Role Kind', type: 'null' },
          style: { $ref: '#/$defs/RefinementStyle' },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: [
          'node_id',
          'text_sha256',
          'evidence_ids',
          'heading_level',
          'parent_id',
          'chapter_start',
          'chapter_role',
          'style',
        ],
        title: 'OcrRefinementDecision',
        type: 'object',
      },
      RecognitionBox: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            const: 'render_normalized_1000',
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: {
            exclusiveMaximum: 1000,
            minimum: 0,
            title: 'X0',
            type: 'number',
          },
          x1: {
            exclusiveMinimum: 0,
            maximum: 1000,
            title: 'X1',
            type: 'number',
          },
          y0: {
            exclusiveMaximum: 1000,
            minimum: 0,
            title: 'Y0',
            type: 'number',
          },
          y1: {
            exclusiveMinimum: 0,
            maximum: 1000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'RecognitionBox',
        type: 'object',
      },
      RecognitionCell: {
        additionalProperties: false,
        properties: {
          box: {
            anyOf: [{ $ref: '#/$defs/RecognitionBox' }, { type: 'null' }],
          },
          column_span: {
            default: 1,
            maximum: 8,
            minimum: 1,
            title: 'Column Span',
            type: 'integer',
          },
          header_axis: {
            anyOf: [
              { enum: ['row', 'column', 'both'], type: 'string' },
              { type: 'null' },
            ],
            title: 'Header Axis',
          },
          row_span: {
            default: 1,
            maximum: 20,
            minimum: 1,
            title: 'Row Span',
            type: 'integer',
          },
          source_cell_id: {
            anyOf: [
              { maxLength: 120, minLength: 1, type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Source Cell Id',
          },
          spans: {
            items: { $ref: '#/$defs/RecognitionSpan' },
            maxItems: 20000,
            title: 'Spans',
            type: 'array',
          },
          style: { anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }] },
          text: { maxLength: 200000, title: 'Text', type: 'string' },
        },
        required: ['text', 'box', 'style', 'header_axis', 'spans'],
        title: 'RecognitionCell',
        type: 'object',
      },
      RecognitionResponse: {
        additionalProperties: false,
        properties: {
          language: {
            maxLength: 50,
            minLength: 1,
            title: 'Language',
            type: 'string',
          },
          render_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Render Sha256',
            type: 'string',
          },
          schema_version: {
            const: 'ava-recognition-response-2',
            title: 'Schema Version',
            type: 'string',
          },
          segments: {
            items: { $ref: '#/$defs/RecognitionSegment' },
            maxItems: 2000,
            title: 'Segments',
            type: 'array',
          },
          source_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Source Sha256',
            type: 'string',
          },
          task_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Task Id',
            type: 'string',
          },
          unresolved: {
            items: { type: 'string' },
            maxItems: 100,
            title: 'Unresolved',
            type: 'array',
          },
        },
        required: [
          'schema_version',
          'task_id',
          'source_sha256',
          'render_sha256',
          'segments',
          'unresolved',
          'language',
        ],
        title: 'RecognitionResponse',
        type: 'object',
      },
      RecognitionSegment: {
        allOf: [
          {
            additionalProperties: false,
            properties: {
              alt: {
                default: '',
                maxLength: 4000,
                title: 'Alt',
                type: 'string',
              },
              box: { $ref: '#/$defs/RecognitionBox' },
              cells: {
                items: {
                  items: { $ref: '#/$defs/RecognitionCell' },
                  type: 'array',
                },
                maxItems: 20,
                title: 'Cells',
                type: 'array',
              },
              chapter_role: {
                anyOf: [
                  {
                    enum: ['frontmatter', 'bodymatter', 'backmatter'],
                    type: 'string',
                  },
                  { type: 'null' },
                ],
                default: null,
                title: 'Chapter Role',
              },
              chapter_start: {
                default: false,
                title: 'Chapter Start',
                type: 'boolean',
              },
              continues_from_previous: {
                title: 'Continues From Previous',
                type: 'boolean',
              },
              continues_to_next: {
                title: 'Continues To Next',
                type: 'boolean',
              },
              heading_level: {
                anyOf: [
                  { maximum: 6, minimum: 1, type: 'integer' },
                  { type: 'null' },
                ],
                default: null,
                title: 'Heading Level',
              },
              id: {
                description: 'Unique within this response; s0001, s0002, ...',
                maxLength: 120,
                minLength: 1,
                title: 'Id',
                type: 'string',
              },
              kind: {
                enum: [
                  'paragraph',
                  'heading',
                  'quote',
                  'aside',
                  'caption',
                  'credit',
                  'verse',
                  'code',
                  'list_item',
                  'note',
                  'figure',
                  'table',
                  'separator',
                  'furniture',
                  'unsupported',
                ],
                title: 'Kind',
                type: 'string',
              },
              list_depth: {
                anyOf: [
                  { maximum: 3, minimum: 1, type: 'integer' },
                  { type: 'null' },
                ],
                default: null,
                title: 'List Depth',
              },
              list_ordered: {
                anyOf: [{ type: 'boolean' }, { type: 'null' }],
                default: null,
                title: 'List Ordered',
              },
              list_start: {
                anyOf: [
                  { maximum: 1000000, minimum: 0, type: 'integer' },
                  { type: 'null' },
                ],
                default: null,
                title: 'List Start',
              },
              method: { const: 'ocr', title: 'Method', type: 'string' },
              note_label: {
                anyOf: [{ maxLength: 100, type: 'string' }, { type: 'null' }],
                default: null,
                title: 'Note Label',
              },
              note_role: {
                anyOf: [
                  { enum: ['footnote', 'endnote'], type: 'string' },
                  { type: 'null' },
                ],
                default: null,
                title: 'Note Role',
              },
              page: {
                maximum: 500,
                minimum: 1,
                title: 'Page',
                type: 'integer',
              },
              related_to: {
                anyOf: [{ maxLength: 120, type: 'string' }, { type: 'null' }],
                default: null,
                title: 'Related To',
              },
              spans: {
                items: { $ref: '#/$defs/RecognitionSpan' },
                maxItems: 20000,
                title: 'Spans',
                type: 'array',
              },
              style: { anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }] },
              text: { maxLength: 200000, title: 'Text', type: 'string' },
            },
            required: [
              'id',
              'page',
              'box',
              'kind',
              'text',
              'style',
              'spans',
              'method',
              'continues_from_previous',
              'continues_to_next',
            ],
            title: 'RecognitionSegment',
            type: 'object',
          },
          {
            anyOf: [
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  heading_level: { maximum: 6, minimum: 1, type: 'integer' },
                  kind: { enum: ['heading'] },
                },
                required: ['chapter_start', 'heading_level'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['note'] },
                  note_label: { minLength: 1, type: 'string' },
                  note_role: { enum: ['footnote', 'endnote'] },
                },
                required: ['note_label', 'note_role'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['list_item'] },
                  list_depth: { maximum: 3, minimum: 1, type: 'integer' },
                  list_ordered: { type: 'boolean' },
                },
                required: ['list_depth', 'list_ordered'],
                type: 'object',
              },
              {
                properties: {
                  cells: {
                    items: { maxItems: 8, minItems: 0, type: 'array' },
                    minItems: 1,
                    type: 'array',
                  },
                  kind: { enum: ['table'] },
                },
                required: ['cells'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['paragraph'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['quote'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['aside'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['caption'] },
                },
                required: ['related_to'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['credit'] },
                },
                required: ['related_to'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['verse'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['code'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['figure'] },
                },
                required: ['alt'],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['separator'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['furniture'] },
                },
                required: [],
                type: 'object',
              },
              {
                properties: {
                  cells: { maxItems: 0, type: 'array' },
                  kind: { enum: ['unsupported'] },
                },
                required: [],
                type: 'object',
              },
            ],
          },
          {
            anyOf: [
              {
                properties: { chapter_start: { const: false } },
                type: 'object',
              },
              {
                properties: {
                  chapter_role: {
                    enum: ['frontmatter', 'bodymatter', 'backmatter'],
                  },
                  chapter_start: { const: true },
                  heading_level: { const: 1 },
                  kind: { enum: ['heading'] },
                },
                required: ['chapter_role', 'chapter_start', 'heading_level'],
                type: 'object',
              },
            ],
          },
          {
            anyOf: [
              {
                properties: { list_ordered: { enum: [null, false] } },
                type: 'object',
              },
              {
                properties: {
                  kind: { enum: ['list_item'] },
                  list_ordered: { const: true },
                  list_start: { maximum: 1000000, minimum: 0, type: 'integer' },
                },
                required: ['list_depth', 'list_ordered', 'list_start'],
                type: 'object',
              },
            ],
          },
        ],
      },
      RecognitionSpan: {
        additionalProperties: false,
        properties: {
          anchor: {
            anyOf: [
              { $ref: '#/$defs/RecognitionTextAnchor' },
              { type: 'null' },
            ],
            default: null,
          },
          end: {
            anyOf: [
              { exclusiveMinimum: 0, maximum: 200000, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'End',
          },
          note_label: {
            anyOf: [{ maxLength: 100, type: 'string' }, { type: 'null' }],
            title: 'Note Label',
          },
          start: {
            anyOf: [
              { maximum: 200000, minimum: 0, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'Start',
          },
          style: { anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }] },
          target_text: {
            anyOf: [{ maxLength: 1000, type: 'string' }, { type: 'null' }],
            title: 'Target Text',
          },
          url: {
            anyOf: [{ maxLength: 2048, type: 'string' }, { type: 'null' }],
            title: 'Url',
          },
        },
        required: ['style', 'note_label', 'target_text', 'url'],
        title: 'RecognitionSpan',
        type: 'object',
      },
      RecognitionTextAnchor: {
        additionalProperties: false,
        properties: {
          after: {
            default: '',
            maxLength: 128,
            title: 'After',
            type: 'string',
          },
          before: {
            default: '',
            maxLength: 128,
            title: 'Before',
            type: 'string',
          },
          exact_text: {
            maxLength: 1000,
            minLength: 1,
            title: 'Exact Text',
            type: 'string',
          },
        },
        required: ['exact_text'],
        title: 'RecognitionTextAnchor',
        type: 'object',
      },
      RefinementJoin: {
        additionalProperties: false,
        properties: {
          edge_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Edge Id',
            type: 'string',
          },
          evidence_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 2,
            title: 'Evidence Ids',
            type: 'array',
          },
          join: { title: 'Join', type: 'boolean' },
        },
        required: ['edge_id', 'join', 'evidence_ids'],
        title: 'RefinementJoin',
        type: 'object',
      },
      RefinementStyle: {
        additionalProperties: false,
        description:
          'Sparse source typography with the wire observations required by acceptance.',
        properties: {
          align: {
            anyOf: [
              {
                enum: ['start', 'left', 'right', 'center', 'justify'],
                type: 'string',
              },
              { type: 'null' },
            ],
            default: null,
            title: 'Align',
          },
          background_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Background Color',
          },
          block_indent_em: {
            anyOf: [
              { maximum: 6, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Block Indent Em',
          },
          bold: { title: 'Bold', type: 'boolean' },
          color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Color',
          },
          decoration_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Decoration Color',
          },
          family: {
            anyOf: [
              { enum: ['serif', 'sans-serif', 'monospace'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Family',
          },
          id: { const: 'observed', title: 'Id', type: 'string' },
          indent_em: {
            anyOf: [
              { maximum: 6, minimum: -3, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Indent Em',
          },
          italic: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Italic',
          },
          line_height: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Line Height',
          },
          relative_size: {
            maximum: 3,
            minimum: 0.5,
            title: 'Relative Size',
            type: 'number',
          },
          small_caps: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Small Caps',
          },
          space_after_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space After Em',
          },
          space_before_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space Before Em',
          },
          strike_through: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Strike Through',
          },
          underline: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Underline',
          },
          vertical_align: {
            anyOf: [
              { enum: ['baseline', 'super', 'sub'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Vertical Align',
          },
        },
        required: ['id', 'bold', 'relative_size'],
        title: 'RefinementStyle',
        type: 'object',
      },
      Style: {
        additionalProperties: false,
        properties: {
          align: {
            anyOf: [
              {
                enum: ['start', 'left', 'right', 'center', 'justify'],
                type: 'string',
              },
              { type: 'null' },
            ],
            default: null,
            title: 'Align',
          },
          background_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Background Color',
          },
          block_indent_em: {
            anyOf: [
              { maximum: 6, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Block Indent Em',
          },
          bold: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Bold',
          },
          color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Color',
          },
          decoration_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Decoration Color',
          },
          family: {
            anyOf: [
              { enum: ['serif', 'sans-serif', 'monospace'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Family',
          },
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          indent_em: {
            anyOf: [
              { maximum: 6, minimum: -3, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Indent Em',
          },
          italic: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Italic',
          },
          line_height: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Line Height',
          },
          relative_size: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Relative Size',
          },
          small_caps: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Small Caps',
          },
          space_after_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space After Em',
          },
          space_before_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space Before Em',
          },
          strike_through: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Strike Through',
          },
          underline: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Underline',
          },
          vertical_align: {
            anyOf: [
              { enum: ['baseline', 'super', 'sub'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Vertical Align',
          },
        },
        required: ['id'],
        title: 'Style',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      profile_id: {
        default: 'ava-pdf-prose-en-v2',
        enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
        title: 'Profile Id',
        type: 'string',
      },
      refinements: {
        items: { $ref: '#/$defs/BookRefinementResponse' },
        maxItems: 32,
        title: 'Refinements',
        type: 'array',
      },
      responses: {
        items: { $ref: '#/$defs/RecognitionResponse' },
        maxItems: 25000,
        title: 'Responses',
        type: 'array',
      },
      schema_version: {
        const: 'ava-reconstruct-input-1',
        title: 'Schema Version',
        type: 'string',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
    },
    required: ['schema_version', 'source_sha256', 'responses'],
    title: 'ReconstructionInput',
    type: 'object',
  },
  ReconstructionReport: {
    $defs: {
      Box: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            enum: ['page_points_top_left', 'normalized_top_left'],
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: { maximum: 20000, minimum: 0, title: 'X0', type: 'number' },
          x1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'X1',
            type: 'number',
          },
          y0: { maximum: 20000, minimum: 0, title: 'Y0', type: 'number' },
          y1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'Box',
        type: 'object',
      },
      Finding: {
        additionalProperties: false,
        properties: {
          block_id: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            default: null,
            title: 'Block Id',
          },
          box: {
            anyOf: [{ $ref: '#/$defs/Box' }, { type: 'null' }],
            default: null,
          },
          code: { maxLength: 100, minLength: 1, title: 'Code', type: 'string' },
          message: {
            maxLength: 1000,
            minLength: 1,
            title: 'Message',
            type: 'string',
          },
          page: {
            anyOf: [
              { maximum: 500, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            default: null,
            title: 'Page',
          },
          severity: {
            enum: ['blocking', 'review', 'information'],
            title: 'Severity',
            type: 'string',
          },
        },
        required: ['code', 'message', 'severity'],
        title: 'Finding',
        type: 'object',
      },
      RefinementEvidence: {
        additionalProperties: false,
        properties: {
          node_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 48,
            minItems: 1,
            title: 'Node Ids',
            type: 'array',
          },
          observation_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Observation Sha256',
            type: 'string',
          },
          response_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Response Sha256',
            type: 'string',
          },
          task_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Task Id',
            type: 'string',
          },
          task_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Task Sha256',
            type: 'string',
          },
        },
        required: [
          'task_id',
          'task_sha256',
          'response_sha256',
          'observation_sha256',
          'node_ids',
        ],
        title: 'RefinementEvidence',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      canonical_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Canonical Sha256',
        type: 'string',
      },
      checks: {
        additionalProperties: { enum: ['pass', 'not_run'], type: 'string' },
        title: 'Checks',
        type: 'object',
      },
      epub_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Epub Sha256',
        type: 'string',
      },
      findings: {
        items: { $ref: '#/$defs/Finding' },
        maxItems: 10000,
        title: 'Findings',
        type: 'array',
      },
      outcome: { const: 'candidate', title: 'Outcome', type: 'string' },
      page_count: {
        maximum: 500,
        minimum: 1,
        title: 'Page Count',
        type: 'integer',
      },
      profile_id: {
        enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
        title: 'Profile Id',
        type: 'string',
      },
      recognition_task_count: {
        maximum: 25000,
        minimum: 0,
        title: 'Recognition Task Count',
        type: 'integer',
      },
      refinement_evidence: {
        items: { $ref: '#/$defs/RefinementEvidence' },
        maxItems: 32,
        title: 'Refinement Evidence',
        type: 'array',
      },
      resource_hashes: {
        additionalProperties: {
          maxLength: 64,
          minLength: 64,
          pattern: '^[0-9a-f]{64}$',
          type: 'string',
        },
        title: 'Resource Hashes',
        type: 'object',
      },
      schema_version: {
        const: 'ava-reconstruction-report-1',
        title: 'Schema Version',
        type: 'string',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
    },
    required: [
      'schema_version',
      'source_sha256',
      'canonical_sha256',
      'epub_sha256',
      'resource_hashes',
      'profile_id',
      'outcome',
      'page_count',
      'recognition_task_count',
      'checks',
      'findings',
    ],
    title: 'ReconstructionReport',
    type: 'object',
  },
  RefinementBatch: {
    $defs: {
      BookRefinementTask: {
        additionalProperties: false,
        properties: {
          crops: {
            items: { $ref: '#/$defs/RefinementCrop' },
            maxItems: 48,
            minItems: 1,
            title: 'Crops',
            type: 'array',
          },
          decision_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 24,
            title: 'Decision Ids',
            type: 'array',
          },
          edges: {
            items: { $ref: '#/$defs/RefinementEdge' },
            maxItems: 16,
            title: 'Edges',
            type: 'array',
          },
          image: { $ref: '#/$defs/RecognitionImage' },
          metadata_ids: {
            items: {
              maxLength: 120,
              pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
              type: 'string',
            },
            maxItems: 24,
            title: 'Metadata Ids',
            type: 'array',
          },
          nodes: {
            items: { $ref: '#/$defs/RefinementNode' },
            maxItems: 256,
            minItems: 1,
            title: 'Nodes',
            type: 'array',
          },
          observation_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Observation Sha256',
            type: 'string',
          },
          pixels_per_point: {
            const: 2,
            title: 'Pixels Per Point',
            type: 'integer',
          },
          profile_id: {
            enum: ['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'],
            title: 'Profile Id',
            type: 'string',
          },
          prompt_version: {
            enum: [
              'ava-book-refinement-3',
              'ava-book-refinement-4',
              'ava-book-refinement-5',
            ],
            title: 'Prompt Version',
            type: 'string',
          },
          response_schema_version: {
            const: 'ava-book-refinement-response-3',
            title: 'Response Schema Version',
            type: 'string',
          },
          schema_version: {
            const: 'ava-book-refinement-task-3',
            title: 'Schema Version',
            type: 'string',
          },
          source_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Source Sha256',
            type: 'string',
          },
          task_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Task Id',
            type: 'string',
          },
        },
        required: [
          'schema_version',
          'task_id',
          'source_sha256',
          'observation_sha256',
          'profile_id',
          'prompt_version',
          'response_schema_version',
          'nodes',
          'pixels_per_point',
          'decision_ids',
          'edges',
          'crops',
          'image',
        ],
        title: 'BookRefinementTask',
        type: 'object',
      },
      Box: {
        additionalProperties: false,
        properties: {
          coordinate_space: {
            enum: ['page_points_top_left', 'normalized_top_left'],
            title: 'Coordinate Space',
            type: 'string',
          },
          x0: { maximum: 20000, minimum: 0, title: 'X0', type: 'number' },
          x1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'X1',
            type: 'number',
          },
          y0: { maximum: 20000, minimum: 0, title: 'Y0', type: 'number' },
          y1: {
            exclusiveMinimum: 0,
            maximum: 20000,
            title: 'Y1',
            type: 'number',
          },
        },
        required: ['coordinate_space', 'x0', 'y0', 'x1', 'y1'],
        title: 'Box',
        type: 'object',
      },
      RecognitionImage: {
        additionalProperties: false,
        properties: {
          base64: {
            maxLength: 22369624,
            minLength: 4,
            title: 'Base64',
            type: 'string',
          },
          byte_length: {
            maximum: 16777216,
            minimum: 1,
            title: 'Byte Length',
            type: 'integer',
          },
          height: {
            maximum: 6000,
            minimum: 1,
            title: 'Height',
            type: 'integer',
          },
          media_type: {
            enum: ['image/png', 'image/jpeg'],
            title: 'Media Type',
            type: 'string',
          },
          sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Sha256',
            type: 'string',
          },
          width: { maximum: 6000, minimum: 1, title: 'Width', type: 'integer' },
        },
        required: [
          'media_type',
          'sha256',
          'byte_length',
          'width',
          'height',
          'base64',
        ],
        title: 'RecognitionImage',
        type: 'object',
      },
      RefinementCrop: {
        additionalProperties: false,
        properties: {
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          image_box: {
            items: { type: 'integer' },
            maxItems: 4,
            minItems: 4,
            title: 'Image Box',
            type: 'array',
          },
          node_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Node Id',
            type: 'string',
          },
          page: { maximum: 500, minimum: 1, title: 'Page', type: 'integer' },
          part: { enum: ['head', 'tail'], title: 'Part', type: 'string' },
          render_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Render Sha256',
            type: 'string',
          },
          source_box: { $ref: '#/$defs/Box' },
        },
        required: [
          'id',
          'part',
          'node_id',
          'page',
          'source_box',
          'render_sha256',
          'image_box',
        ],
        title: 'RefinementCrop',
        type: 'object',
      },
      RefinementEdge: {
        additionalProperties: false,
        properties: {
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          next_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Next Id',
            type: 'string',
          },
          previous_id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Previous Id',
            type: 'string',
          },
        },
        required: ['id', 'previous_id', 'next_id'],
        title: 'RefinementEdge',
        type: 'object',
      },
      RefinementNode: {
        additionalProperties: false,
        properties: {
          body_reference_id: {
            anyOf: [
              {
                maxLength: 120,
                pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Body Reference Id',
          },
          candidate_original_kind: {
            anyOf: [
              { enum: ['paragraph', 'list_item', 'verse'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Candidate Original Kind',
          },
          context_after: {
            default: '',
            maxLength: 200,
            title: 'Context After',
            type: 'string',
          },
          context_before: {
            default: '',
            maxLength: 200,
            title: 'Context Before',
            type: 'string',
          },
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          kind: {
            enum: ['heading', 'paragraph'],
            title: 'Kind',
            type: 'string',
          },
          observed_chapter: { title: 'Observed Chapter', type: 'boolean' },
          observed_level: {
            anyOf: [
              { maximum: 6, minimum: 1, type: 'integer' },
              { type: 'null' },
            ],
            title: 'Observed Level',
          },
          observed_role: {
            anyOf: [
              {
                enum: ['frontmatter', 'bodymatter', 'backmatter'],
                type: 'string',
              },
              { type: 'null' },
            ],
            title: 'Observed Role',
          },
          observed_style: {
            anyOf: [{ $ref: '#/$defs/Style' }, { type: 'null' }],
          },
          page: { maximum: 500, minimum: 1, title: 'Page', type: 'integer' },
          ranked_source: { title: 'Ranked Source', type: 'boolean' },
          structure_candidate: {
            default: false,
            title: 'Structure Candidate',
            type: 'boolean',
          },
          text_excerpt: {
            maxLength: 500,
            title: 'Text Excerpt',
            type: 'string',
          },
          text_sha256: {
            maxLength: 64,
            minLength: 64,
            pattern: '^[0-9a-f]{64}$',
            title: 'Text Sha256',
            type: 'string',
          },
        },
        required: [
          'id',
          'page',
          'kind',
          'text_sha256',
          'text_excerpt',
          'observed_level',
          'observed_chapter',
          'observed_role',
          'observed_style',
          'ranked_source',
          'body_reference_id',
        ],
        title: 'RefinementNode',
        type: 'object',
      },
      Style: {
        additionalProperties: false,
        properties: {
          align: {
            anyOf: [
              {
                enum: ['start', 'left', 'right', 'center', 'justify'],
                type: 'string',
              },
              { type: 'null' },
            ],
            default: null,
            title: 'Align',
          },
          background_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Background Color',
          },
          block_indent_em: {
            anyOf: [
              { maximum: 6, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Block Indent Em',
          },
          bold: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Bold',
          },
          color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Color',
          },
          decoration_color: {
            anyOf: [
              { pattern: '^#[0-9a-f]{6}$', type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Decoration Color',
          },
          family: {
            anyOf: [
              { enum: ['serif', 'sans-serif', 'monospace'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Family',
          },
          id: {
            maxLength: 120,
            pattern: '^[A-Za-z][A-Za-z0-9_.-]{0,119}$',
            title: 'Id',
            type: 'string',
          },
          indent_em: {
            anyOf: [
              { maximum: 6, minimum: -3, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Indent Em',
          },
          italic: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Italic',
          },
          line_height: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Line Height',
          },
          relative_size: {
            anyOf: [
              { maximum: 3, minimum: 0.5, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Relative Size',
          },
          small_caps: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Small Caps',
          },
          space_after_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space After Em',
          },
          space_before_em: {
            anyOf: [
              { maximum: 5, minimum: 0, type: 'number' },
              { type: 'null' },
            ],
            default: null,
            title: 'Space Before Em',
          },
          strike_through: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Strike Through',
          },
          underline: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
            default: null,
            title: 'Underline',
          },
          vertical_align: {
            anyOf: [
              { enum: ['baseline', 'super', 'sub'], type: 'string' },
              { type: 'null' },
            ],
            default: null,
            title: 'Vertical Align',
          },
        },
        required: ['id'],
        title: 'Style',
        type: 'object',
      },
    },
    additionalProperties: false,
    properties: {
      schema_version: {
        const: 'ava-book-refinement-batch-1',
        title: 'Schema Version',
        type: 'string',
      },
      source_sha256: {
        maxLength: 64,
        minLength: 64,
        pattern: '^[0-9a-f]{64}$',
        title: 'Source Sha256',
        type: 'string',
      },
      tasks: {
        items: { $ref: '#/$defs/BookRefinementTask' },
        maxItems: 32,
        title: 'Tasks',
        type: 'array',
      },
    },
    required: ['schema_version', 'source_sha256', 'tasks'],
    title: 'RefinementBatch',
    type: 'object',
  },
};
