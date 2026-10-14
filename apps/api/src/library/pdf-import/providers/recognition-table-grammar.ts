type Schema = Record<string, unknown>;

// Share the segment fields; only table shape needs a separate generation branch.
// Canonical kind requirements and source checks remain authoritative.
export function recognitionTableGrammar(segment: Schema) {
  const properties = segment.properties as Record<string, Schema>;
  const kinds = properties.kind.enum as string[];
  segment.anyOf = [
    {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: kinds.filter((kind) => kind !== 'table'),
        },
        cells: { type: 'array', maxItems: 0 },
      },
    },
    {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['table'] },
        cells: { type: 'array', minItems: 1 },
      },
      required: ['cells'],
    },
  ];
}
