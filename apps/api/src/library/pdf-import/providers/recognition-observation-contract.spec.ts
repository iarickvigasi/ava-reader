import {
  recognitionObservationSchema,
  recognitionObservationSystem,
} from './recognition-observation-contract';
import { observationTask } from './recognition-observation-fixture';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
it('projects host-owned fields and adds only the versioned finite font alias', () => {
  const before = JSON.stringify(recognitionSchemas.RecognitionResponse);
  const schema = recognitionObservationSchema() as {
    properties: Record<string, unknown>;
    required: string[];
    $defs: Record<
      string,
      {
        properties: Record<string, unknown>;
        required: string[];
        allOf: { properties: Record<string, unknown>; required: string[] }[];
      }
    >;
  };
  expect(schema.properties).not.toHaveProperty('task_id');
  expect(schema.properties).not.toHaveProperty('source_sha256');
  expect(schema.properties).not.toHaveProperty('render_sha256');
  expect(
    schema.$defs.RecognitionSegment.allOf[0].properties,
  ).not.toHaveProperty('page');
  expect(schema.$defs.Style.properties).not.toHaveProperty('id');
  expect(schema.$defs.RecognitionSegment.allOf[0].required).toContain('kind');
  expect(schema.$defs.RecognitionSegment.allOf[0].required).not.toContain(
    'method',
  );
  expect(
    schema.$defs.RecognitionSegment.allOf[0].properties.method,
  ).toMatchObject({ const: 'ocr' });
  expect(schema.$defs.RecognitionSegment.allOf[0].properties).toHaveProperty(
    'id',
  );
  expect(JSON.stringify(recognitionSchemas.RecognitionResponse)).toBe(before);
});
it('fails closed on metadata instruction drift without changing canonical system text', () => {
  const system = observationTask.messages[0].content as string;
  const projected = recognitionObservationSystem(system);
  expect(projected).not.toContain('Copy the supplied task/source/render');
  expect(projected).not.toContain('with its own ID');
  expect(projected).not.toContain('"id":"body"');
  expect(projected).toContain('ava-recognition-observation-2');
  expect(() =>
    recognitionObservationSystem(
      system.replace('Copy the supplied', 'Copy supplied'),
    ),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  expect(observationTask.messages[0].content).toBe(system);
});
