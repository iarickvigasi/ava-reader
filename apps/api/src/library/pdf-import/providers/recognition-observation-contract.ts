import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { PdfProviderError } from './errors';
import { OBSERVED_FONT_FAMILIES } from './recognition-observation-styles';
export const RECOGNITION_OBSERVATION_WIRE = 'ava-recognition-observation-2';
type Shape = { properties: Record<string, unknown>; required: string[] };
export function recognitionObservationSchema(): Record<string, unknown> {
  const schema = structuredClone(
    recognitionSchemas.RecognitionResponse,
  ) as unknown as Shape & {
    $defs: {
      RecognitionSegment: { allOf: Shape[] };
      Style: Shape & { not?: object };
    };
  };
  schema.properties.schema_version = {
    const: RECOGNITION_OBSERVATION_WIRE,
    type: 'string',
  };
  for (const field of ['task_id', 'source_sha256', 'render_sha256']) {
    delete schema.properties[field];
    schema.required = schema.required.filter((name) => name !== field);
  }
  const segment = schema.$defs.RecognitionSegment.allOf[0];
  delete segment.properties.page;
  segment.required = segment.required.filter(
    (name) => !['page', 'method'].includes(name),
  );
  delete schema.$defs.Style.properties.id;
  schema.$defs.Style.required = schema.$defs.Style.required.filter(
    (name) => name !== 'id',
  );
  schema.$defs.Style.properties.font_family_role = {
    type: 'string',
    enum: [...OBSERVED_FONT_FAMILIES],
  };
  schema.$defs.Style.not = { required: ['family', 'font_family_role'] };
  return schema;
}
const identity =
  'Copy the supplied task/source/render identities and page\nnumber. Set schema_version to ava-recognition-response-2 and method to ocr.';
const styleId =
  'properties in a style object (with its own ID); omitted properties mean unknown, NOT false.';
const styleExample =
  'Even when several observations have the same style ID, repeat their sparse observed style\nOBJECT at each occurrence. For example: "style":{"id":"body","bold":false,"italic":false}.';
export function recognitionObservationSystem(system: string): string {
  if (
    system.split(identity).length !== 2 ||
    system.split(styleId).length !== 2 ||
    (system.includes('STYLE ENCODING:') &&
      system.split(styleExample).length !== 2)
  )
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  return (
    system
      .replace(
        identity,
        `Set schema_version to ${RECOGNITION_OBSERVATION_WIRE} and omit method (the host binds OCR provenance); if supplied, it must be ocr.\nDo not return task_id, source_sha256, render_sha256, segment.page or style.id; the host supplies them.`,
      )
      .replace(
        styleId,
        'properties in a style object; omitted properties mean unknown, NOT false.',
      )
      .replace(
        styleExample,
        'Repeat each sparse observed style OBJECT at each occurrence. For example:\n"style":{"family":"serif","bold":false,"italic":false}.',
      ) +
    '\nUse style.family for font role: serif, sans-serif or monospace. ' +
    'Wire version 2 also accepts font_family_role with exactly one of those values, ' +
    'only when family is absent. Never emit both names or invent other style keys.'
  );
}
