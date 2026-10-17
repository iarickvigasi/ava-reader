import { checksumBuffer } from '../../shared/blob-utils';
import { refinementProviderTask } from './refinement-provider-task';
import { refinementEvidence } from './refinement-evidence';
import { refinementResponse } from './refinement-response';
import { validatePacket } from './validate-packet';
import { validateRefinementBatch } from './refinement-packets';
import {
  printedTitleTask,
  printedTitleResponse,
} from './printed-title-fixture';
import {
  refinementTask,
  refinementResponse as historicalResponse,
} from './refinement-fixture';
import { PRINTED_TITLE_PROMPT } from './generated/printed-title-prompt';
import { recognitionSchemas } from './generated/schemas';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { prepareProviderRequest } from '../../library/pdf-import/providers/prepare-request';
import { jsonHash } from '../../library/pdf-import/providers/hash';
import { route } from '../../library/pdf-import/providers/test-fixtures';

it('dispatches the separate finite printed-title contract without replacing the heading', () => {
  const task = refinementProviderTask(
    printedTitleTask,
    printedTitleTask.source_sha256,
  );
  expect(task).toMatchObject({
    purpose: 'resolve_structure',
    pageIndices: [0],
    promptVersion: 'ava-printed-title-1',
    schemaVersion: 'ava-printed-title-response-1',
  });
  expect(task.messages[0]).toEqual({
    role: 'system',
    content: PRINTED_TITLE_PROMPT,
  });
  expect(task.responseSchema).toEqual(recognitionSchemas.PrintedTitleResponse);
  expect(refinementEvidence(printedTitleTask)).toMatchObject({
    required_title_evidence: {
      'opening-title': printedTitleTask.crops.map((c) => c.id),
    },
  });
  expect(printedTitleTask.node.text).toBe('The Quiet River');
  expect(
    providerResponseSchema('google/gemini-contract-control', task),
  ).toHaveProperty('description', expect.stringContaining('printed-title'));
});
it('requires exact new prompt and canonical schema authorization before creating a provider request', () => {
  const task = refinementProviderTask(
    printedTitleTask,
    printedTitleTask.source_sha256,
  );
  expect(() => prepareProviderRequest(route, task)).toThrow(
    'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  );
  const configured = {
    ...route,
    modelId: 'google/gemini-contract-control',
    configuration: {
      ...(route.configuration as object),
      promptHashes: {
        [task.promptVersion]: checksumBuffer(Buffer.from(PRINTED_TITLE_PROMPT)),
      },
      schemaHashes: { [task.schemaVersion]: jsonHash(task.responseSchema) },
    },
  };
  const request = prepareProviderRequest(configured, task);
  expect(request.taskSha256).toBe(jsonHash(task));
  const body = JSON.parse(request.request.toString()) as {
    response_format: { json_schema: { schema: unknown } };
  };
  expect(body.response_format.json_schema.schema).toEqual(
    providerResponseSchema(configured.modelId, task),
  );
  expect(() =>
    providerResponseSchema(configured.modelId, { ...task, responseSchema: {} }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
it.each(['title', null] as const)(
  'accepts only a whole bound title-or-null decision: %s',
  (role) => {
    const response = {
      ...printedTitleResponse,
      decision: { ...printedTitleResponse.decision, role },
    };
    expect(
      refinementResponse(printedTitleTask, JSON.stringify(response)),
    ).toEqual(response);
  },
);
it.each(['task_id', 'source_sha256', 'observation_sha256', 'image_sha256'])(
  'refuses foreign %s response identity',
  (field) => {
    const response = {
      ...printedTitleResponse,
      [field]: field === 'task_id' ? 'foreign-task' : 'f'.repeat(64),
    };
    expect(() =>
      refinementResponse(printedTitleTask, JSON.stringify(response)),
    ).toThrow('SOURCE_MISMATCH');
  },
);
it.each(['node_id', 'text_sha256', 'evidence_ids'])(
  'refuses foreign/duplicate decision %s',
  (field) => {
    const value =
      field === 'evidence_ids'
        ? [printedTitleTask.crops[0].id, printedTitleTask.crops[0].id]
        : field === 'node_id'
          ? 'other-node'
          : 'f'.repeat(64);
    const response = {
      ...printedTitleResponse,
      decision: { ...printedTitleResponse.decision, [field]: value },
    };
    expect(() =>
      refinementResponse(printedTitleTask, JSON.stringify(response)),
    ).toThrow('SOURCE_MISMATCH');
  },
);
it.each(['text', 'author', 'style', 'chapter_role'])(
  'rejects replacement or unrelated %s fields without logging their contents',
  (field) => {
    const response = {
      ...printedTitleResponse,
      decision: {
        ...printedTitleResponse.decision,
        [field]: 'private replacement bearer sk-secret',
      },
    };
    try {
      refinementResponse(printedTitleTask, JSON.stringify(response));
      throw Error('accepted');
    } catch (error) {
      expect((error as Error).message).toBe('INVALID_RESULT');
      expect(JSON.stringify(error)).not.toMatch(
        /private replacement|sk-secret|bearer/,
      );
    }
  },
);
it('keeps old task/response and B1/Input1 authority separate from the new classification', () => {
  expect(validatePacket('BookRefinementTask', refinementTask)).toEqual(
    refinementTask,
  );
  expect(validatePacket('BookRefinementResponse', historicalResponse)).toEqual(
    historicalResponse,
  );
  expect(() => validatePacket('BookRefinementTask', printedTitleTask)).toThrow(
    'INVALID_RESULT',
  );
  expect(() => validatePacket('SourceFeatureTask', printedTitleTask)).toThrow(
    'INVALID_RESULT',
  );
  expect(() =>
    validatePacket('BookRefinementResponse', printedTitleResponse),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validateRefinementBatch({
      schema_version: 'ava-book-refinement-batch-1',
      source_sha256: printedTitleTask.source_sha256,
      tasks: [printedTitleTask],
    }),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    validatePacket('ReconstructionInput', {
      schema_version: 'ava-reconstruct-input-1',
      source_sha256: printedTitleTask.source_sha256,
      responses: [],
      refinements: [printedTitleResponse],
    }),
  ).toThrow('INVALID_RESULT');
});
it('B2/Input2 require exactly one printed-title task/receipt, never a generic escape version', () => {
  const batch = {
    schema_version: 'ava-book-refinement-batch-2',
    source_sha256: printedTitleTask.source_sha256,
    tasks: [refinementTask, printedTitleTask],
  };
  expect(validateRefinementBatch(batch)).toEqual(batch);
  for (const tasks of [[refinementTask], [printedTitleTask, printedTitleTask]])
    expect(() => validateRefinementBatch({ ...batch, tasks })).toThrow(
      'INVALID_RESULT',
    );
  const input = {
    schema_version: 'ava-reconstruct-input-2',
    profile_id: printedTitleTask.profile_id,
    source_feature_policy: 'ava-ocr-source-features-1',
    source_sha256: printedTitleTask.source_sha256,
    responses: [],
    refinements: [historicalResponse, printedTitleResponse],
  };
  expect(validatePacket('PrintedTitleReconstructionInput', input)).toEqual(
    input,
  );
  for (const refinements of [
    undefined,
    [],
    [historicalResponse],
    [printedTitleResponse, printedTitleResponse],
  ])
    expect(() =>
      validatePacket('PrintedTitleReconstructionInput', {
        schema_version: 'ava-reconstruct-input-2',
        source_sha256: printedTitleTask.source_sha256,
        responses: [],
        refinements,
      }),
    ).toThrow('INVALID_RESULT');
});
it.each(['source', 'image', 'text', 'crops'])(
  'refuses altered title-task %s before dispatch',
  (kind) => {
    const task = structuredClone(printedTitleTask);
    if (kind === 'image') task.image.sha256 = 'f'.repeat(64);
    if (kind === 'text') task.node.text_sha256 = 'f'.repeat(64);
    if (kind === 'crops') task.crops[1].id = task.crops[0].id;
    expect(() =>
      refinementProviderTask(
        task,
        kind === 'source' ? 'f'.repeat(64) : task.source_sha256,
      ),
    ).toThrow('SOURCE_MISMATCH');
  },
);
