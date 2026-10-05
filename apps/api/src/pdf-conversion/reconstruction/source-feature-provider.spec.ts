import { refinementProviderTask } from './refinement-provider-task';
import { refinementEvidence } from './refinement-evidence';
import { validatePacket } from './validate-packet';
import { SOURCE_FEATURE_PROMPT } from './generated/refinement-prompt';
import { recognitionSchemas } from './generated/schemas';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import {
  featureTask,
  featureResponse,
} from './source-feature-contract-fixture';

it('dispatches only the distinct finite4 schema and exact source-local crop obligations', () => {
  const task = refinementProviderTask(featureTask, featureTask.source_sha256);
  expect(task.schemaVersion).toBe('ava-book-refinement-response-4');
  expect(task.messages[0]).toEqual({
    role: 'system',
    content: SOURCE_FEATURE_PROMPT,
  });
  expect(task.responseSchema).toEqual(recognitionSchemas.SourceFeatureResponse);
  expect(task.responseSchema).not.toEqual(
    recognitionSchemas.BookRefinementResponse,
  );
  const maps = refinementEvidence(featureTask).required_feature_evidence!;
  for (const q of featureTask.source_features)
    for (const f of q.requested_features)
      expect(maps[q.node_id][f]).toEqual(
        featureTask.crops
          .filter((c) => c.request_node_id === q.node_id)
          .map((c) => c.id),
      );
  expect(
    providerResponseSchema('google/gemini-contract-control', task),
  ).toHaveProperty('description', expect.stringContaining('finite OCR'));
});
it('validates authored strict4 fixtures while refusing them under historical3 authority', () => {
  expect(validatePacket('SourceFeatureTask', featureTask)).toEqual(featureTask);
  expect(validatePacket('SourceFeatureResponse', featureResponse)).toEqual(
    featureResponse,
  );
  expect(() => validatePacket('BookRefinementTask', featureTask)).toThrow(
    'INVALID_RESULT',
  );
  expect(() =>
    validatePacket('BookRefinementResponse', featureResponse),
  ).toThrow('INVALID_RESULT');
});
it.each(['text', 'parent_id', 'chapter_start', 'style'])(
  'refuses unauthorized %s replacement fields',
  (key) => {
    const value = structuredClone(featureResponse);
    Object.assign(value.feature_decisions[0], { [key]: 'invented' });
    expect(() => validatePacket('SourceFeatureResponse', value)).toThrow(
      'INVALID_RESULT',
    );
  },
);
it('does not authorize a changed provider schema or foreign source', () => {
  expect(() => refinementProviderTask(featureTask, 'f'.repeat(64))).toThrow(
    'SOURCE_MISMATCH',
  );
  const task = refinementProviderTask(featureTask, featureTask.source_sha256);
  expect(() =>
    providerResponseSchema('google/gemini-contract-control', {
      ...task,
      responseSchema: {},
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
