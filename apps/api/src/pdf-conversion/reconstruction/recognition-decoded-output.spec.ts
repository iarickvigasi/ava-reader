import {
  authoredTask,
  authoredResponse,
} from './recognition-json-authored-fixture';
import { recognitionDecodedOutput } from './recognition-decoded-output';
import { ResponseValidationError } from './response-validation-error';
import { overflowParent, overflowOriginal } from './overflow-context-fixture';

it('retains the source-bound missing-role diagnostic through ordinary decoding', () => {
  const raw = structuredClone(authoredResponse);
  Object.assign(raw.segments[0], {
    kind: 'heading',
    heading_level: 1,
    chapter_start: true,
  });
  delete raw.segments[0].chapter_role;
  const before = JSON.stringify(raw);
  let failure: unknown;
  try {
    recognitionDecodedOutput(authoredTask, before);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ResponseValidationError);
  expect((failure as ResponseValidationError).diagnostic()).toMatchObject({
    category: 'SCHEMA_VALIDATION',
    sourceSha256: authoredTask.source_sha256,
    renderSha256: authoredTask.image.sha256,
    pageNumber: authoredTask.page_number,
    matchingKindRequiredFields: [
      { instancePath: ['segments', 0], field: 'chapter_role' },
    ],
  });
  expect(JSON.stringify(raw)).toBe(before);
});
it('retains parse diagnostics when narrow overflow recovery cannot apply', () => {
  let failure: unknown;
  try {
    recognitionDecodedOutput(authoredTask, '{');
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ResponseValidationError);
  expect((failure as ResponseValidationError).diagnostic()).toMatchObject({
    category: 'JSON_PARSE',
    sourceSha256: authoredTask.source_sha256,
  });
});
it('does not hide an additional schema fault behind an eligible overlong context', () => {
  const raw = structuredClone(overflowOriginal);
  Object.assign(raw.segments[0], {
    kind: 'heading',
    heading_level: 1,
    chapter_start: true,
  });
  delete raw.segments[0].chapter_role;
  let failure: unknown;
  try {
    recognitionDecodedOutput(overflowParent, JSON.stringify(raw));
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ResponseValidationError);
  expect((failure as ResponseValidationError).diagnostic()).toMatchObject({
    matchingKindRequiredFields: [
      { instancePath: ['segments', 0], field: 'chapter_role' },
    ],
  });
});
