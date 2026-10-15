import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { PdfProviderError } from './errors';
export const RECOGNITION_OBSERVATION_WIRE = 'ava-recognition-observation-1';
type Shape = { properties: Record<string, unknown>; required: string[] };
export function recognitionObservationSchema(): Record<string, unknown> {
  const schema = structuredClone(
    recognitionSchemas.RecognitionResponse,
  ) as unknown as Shape & {
    $defs: { RecognitionSegment: { allOf: Shape[] }; Style: Shape };
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
  segment.required = segment.required.filter((name) => name !== 'page');
  delete schema.$defs.Style.properties.id;
  schema.$defs.Style.required = schema.$defs.Style.required.filter(
    (name) => name !== 'id',
  );
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
  return system
    .replace(
      identity,
      `Set schema_version to ${RECOGNITION_OBSERVATION_WIRE} and method to ocr.\nDo not return task_id, source_sha256, render_sha256, segment.page or style.id; the host supplies them.`,
    )
    .replace(
      styleId,
      'properties in a style object; omitted properties mean unknown, NOT false.',
    )
    .replace(
      styleExample,
      'Repeat each sparse observed style OBJECT at each occurrence. For example:\n"style":{"bold":false,"italic":false}.',
    );
}
