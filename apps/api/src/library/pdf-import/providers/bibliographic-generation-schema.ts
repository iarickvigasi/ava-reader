import { PdfProviderError } from './errors';

type Schema = Record<string, unknown>;
const record = (value: unknown): Schema => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return value as Schema;
};
const nonNull = (value: unknown, type: string): Schema => {
  const variants = record(value).anyOf;
  if (!Array.isArray(variants) || variants.length !== 2)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  const selected = variants.map(record).find((branch) => branch.type === type);
  if (!selected || !variants.some((branch) => record(branch).type === 'null'))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  return structuredClone(selected);
};

// Generation guidance only. Python still checks exact source ranges and evidence.
export function bibliographicGenerationSchema(output: Schema, ids: string[]) {
  if (!ids.length) return;
  const metadata = record(record(output.properties).metadata_decisions),
    item = record(metadata.items),
    properties = record(item.properties),
    required = item.required;
  if (
    !Array.isArray(required) ||
    required.some((field) => typeof field !== 'string')
  )
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  const fields = {
    ...properties,
    node_id: { ...record(properties.node_id), enum: ids },
  };
  const mandatory = [...new Set([...(required as string[]), 'start', 'end'])];
  metadata.items = {
    anyOf: [
      {
        ...item,
        properties: {
          ...fields,
          role: nonNull(properties.role, 'string'),
          start: nonNull(properties.start, 'integer'),
          end: { ...nonNull(properties.end, 'integer'), minimum: 1 },
        },
        required: mandatory,
        description:
          'A selected bibliographic role requires BOTH source offsets: start is inclusive and end is exclusive in Unicode code points of this exact node text_excerpt. Cite its source crop. Never omit the end or return invented text; host and worker validate the complete range.',
      },
      {
        ...item,
        properties: {
          ...fields,
          role: { type: 'null' },
          start: { type: 'null' },
          end: { type: 'null' },
        },
        required: mandatory,
        description:
          'Decline an unknown or inapplicable bibliographic role explicitly with role, start and end all null; retain the supplied node identity and source evidence.',
      },
    ],
  };
}
