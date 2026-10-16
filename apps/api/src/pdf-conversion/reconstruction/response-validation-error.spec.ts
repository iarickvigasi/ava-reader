import { createHash } from 'node:crypto';
import { recognitionResponse } from './recognition-response';
import { ResponseValidationError } from './response-validation-error';
import {
  hostResponseValidationFinding,
  schemaValidationDetails,
} from './response-validation-finding';
import { task, response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';
import {
  safeEventSchema,
  eventIdentity,
} from '../../library/pdf-import/reports/event-contract';

const reject = (output: string) => {
  try {
    recognitionResponse(task, output);
  } catch (error) {
    expect(error).toBeInstanceOf(ResponseValidationError);
    return error as ResponseValidationError;
  }
  throw new Error('Expected refusal');
};
it('retains table schema failure checks without logging model text or AJV parameters', () => {
  const segment: Record<string, unknown> = {
    ...wireSegment,
    kind: 'table',
    text: 'PRIVATE_BOOK sk-secret bearer-secret',
  };
  delete segment.cells;
  const finding = reject(
    JSON.stringify({ ...response, segments: [segment] }),
  ).diagnostic()!;
  expect(finding).toMatchObject({
    origin: 'HOST_RESPONSE',
    category: 'SCHEMA_VALIDATION',
    schema: 'RecognitionResponse',
    sourceSha256: task.source_sha256,
    renderSha256: task.image.sha256,
    pageNumber: 1,
    taskIdSha256: createHash('sha256').update(task.task_id).digest('hex'),
  });
  expect(finding.checks).toContainEqual(
    expect.objectContaining({
      keyword: 'required',
      instancePath: ['segments', 0],
    }),
  );
  expect(finding.checks.length).toBeLessThanOrEqual(16);
  expect(finding.checksAreAlternatives).toBe(true);
  expect(finding.matchingKindRequiredFields).toContainEqual({
    instancePath: ['segments', 0],
    field: 'cells',
  });
  expect(JSON.stringify(finding)).not.toMatch(
    /PRIVATE_BOOK|sk-secret|bearer|params|message|missingProperty/,
  );
  expect(hostResponseValidationFinding.parse(finding)).toEqual(finding);
});
it.each(['{"source":"PRIVATE_BOOK sk-secret"', '```json\n{}\n```'])(
  'keeps malformed JSON refusal with an exact task-bound safe category',
  (output) => {
    expect(reject(output).diagnostic()).toMatchObject({
      category: 'JSON_PARSE',
      checks: [],
      complete: true,
    });
    expect(JSON.stringify(reject(output))).not.toMatch(
      /PRIVATE_BOOK|sk-secret/,
    );
  },
);
it('preserves valid output and rejects unknown schema fields without exporting their names', () => {
  expect(recognitionResponse(task, JSON.stringify(response))).toEqual(response);
  const finding = reject(
    JSON.stringify({ ...response, PRIVATE_BOOK_sk_secret: 'private' }),
  ).diagnostic()!;
  expect(finding.checks).toContainEqual(
    expect.objectContaining({ keyword: 'additionalProperties' }),
  );
  expect(JSON.stringify(finding)).not.toMatch(
    /PRIVATE_BOOK|sk_secret|private|additionalProperty/,
  );
});
it('drops untrusted property paths and clips checks with truthful incomplete coverage', () => {
  const entry = {
    keyword: 'type',
    schemaPath: '#/properties/language/type',
    instancePath: '/language',
  };
  const result = schemaValidationDetails([
    { ...entry, instancePath: '/PRIVATE_BOOK_sk_secret' },
    ...Array.from({ length: 20 }, () => entry),
  ]);
  expect(result.checks).toHaveLength(15);
  expect(result.complete).toBe(false);
  expect(JSON.stringify(result)).not.toContain('PRIVATE_BOOK');
});
it('retains INVALID_RESULT even when optional task diagnostic binding is invalid', () => {
  const failure = reject('{}');
  const malformed = {
    ...task,
    task_id: Symbol('private') as unknown as string,
  };
  expect(() => failure.bind(malformed)).not.toThrow();
  expect(failure.bind(malformed)).toMatchObject({ code: 'INVALID_RESULT' });
  expect(failure.bind(malformed).diagnostic()).toBeUndefined();
});
it('retains safe findings through the existing strict event identity and refuses foreign binding', () => {
  const finding = reject('{}').diagnostic()!;
  const event = {
    kind: 'STAGE_ENDED' as const,
    severity: 'WARN' as const,
    stage: 'WORKER_COMMAND',
    details: {
      sourceSha256: task.source_sha256,
      hostResponseValidation: finding,
    },
  };
  const retained = eventIdentity('authored-producer', event);
  expect(
    (
      JSON.parse(JSON.stringify(retained.event)) as {
        details: { hostResponseValidation: unknown };
      }
    ).details.hostResponseValidation,
  ).toEqual(finding);
  expect(
    safeEventSchema.safeParse({
      ...event,
      details: { ...event.details, sourceSha256: 'f'.repeat(64) },
    }).success,
  ).toBe(false);
  expect(
    hostResponseValidationFinding.safeParse({ ...finding, rawError: 'private' })
      .success,
  ).toBe(false);
});

it.each([16, 17])(
  'reports matching-kind field clipping accurately for %s missing cells',
  (count) => {
    const details = schemaValidationDetails(
      [{ keyword: 'required', schemaPath: '#/required', instancePath: '' }],
      {
        segments: Array.from({ length: count }, () => {
          const segment: Record<string, unknown> = {
            ...wireSegment,
            kind: 'table',
          };
          delete segment.cells;
          return segment;
        }),
      },
    );
    expect(details.matchingKindRequiredFields).toHaveLength(16);
    expect(details.complete).toBe(count === 16);
  },
);

it('reports missing table provenance without requiring a chapter role for a section heading', () => {
  const table: Record<string, unknown> = {
    ...wireSegment,
    kind: 'table',
    cells: [[]],
  };
  delete table.method;
  const heading = {
    ...wireSegment,
    kind: 'heading',
    heading_level: 2,
    chapter_start: false,
  };
  const finding = schemaValidationDetails([], { segments: [table, heading] });
  expect(finding.matchingKindRequiredFields).toEqual([
    { instancePath: ['segments', 0], field: 'method' },
  ]);
});
it.each([false, true])(
  'applies conditional chapter and ordered-list requirements only when observed: %s',
  (enabled) => {
    const heading: Record<string, unknown> = {
      ...wireSegment,
      kind: 'heading',
      heading_level: 1,
      chapter_start: enabled,
    };
    const list: Record<string, unknown> = {
      ...wireSegment,
      kind: 'list_item',
      list_depth: 1,
      list_ordered: enabled,
    };
    delete heading.chapter_role;
    delete list.list_start;
    const finding = schemaValidationDetails([], {
      segments: [heading, list],
    });
    expect(finding.matchingKindRequiredFields).toEqual(
      enabled
        ? [
            { instancePath: ['segments', 0], field: 'chapter_role' },
            { instancePath: ['segments', 1], field: 'list_start' },
          ]
        : [],
    );
  },
);
