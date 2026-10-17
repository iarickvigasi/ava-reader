import {
  BIBLIOGRAPHIC_PROMPT,
  REFINEMENT_PROMPT,
} from './generated/refinement-prompt';
import { refinementTask, refinementResponse } from './refinement-fixture';
import { refinementProviderTask } from './refinement-provider-task';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { validatePacket } from './validate-packet';
import Ajv2020 from 'ajv/dist/2020';

it('dispatches a source-bound metadata task with compact instructions and exact crop obligations', () => {
  const input = {
    ...refinementTask,
    prompt_version: 'ava-book-refinement-4' as const,
    decision_ids: [],
    metadata_ids: ['heading'],
  };
  const task = refinementProviderTask(input, input.source_sha256);
  expect(task.purpose).toBe('resolve_structure');
  expect(task.messages[0].content).toBe(BIBLIOGRAPHIC_PROMPT);
  expect(task.messages[0].content).not.toBe(REFINEMENT_PROMPT);
  const content = task.messages[1].content as { type: string; text?: string }[];
  const context = JSON.parse(content[0].text!) as {
    required_metadata_evidence: Record<string, string[]>;
    required_decision_evidence: Record<string, string[]>;
  };
  expect(context.required_metadata_evidence).toEqual({
    heading: ['crop-heading'],
  });
  expect(context.required_decision_evidence).toEqual({});
  const response = {
    ...refinementResponse,
    decisions: [],
    metadata_decisions: [
      {
        node_id: 'heading',
        text_sha256: input.nodes[0].text_sha256,
        evidence_ids: ['crop-heading'],
        role: 'author',
        start: 0,
        end: 7,
      },
    ],
  };
  expect(validatePacket('BookRefinementResponse', response)).toEqual(response);
  const validate = new Ajv2020({
    strict: true,
    validateFormats: false,
  }).compile(providerResponseSchema('google/gemini-3.8-flash', task));
  expect(validate(response)).toBe(true);
  expect(
    validate({
      ...response,
      metadata_decisions: [
        {
          ...response.metadata_decisions[0],
          text: 'An invented name',
        },
      ],
    }),
  ).toBe(false);
});
