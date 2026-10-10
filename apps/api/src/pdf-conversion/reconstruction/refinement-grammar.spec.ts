import { refinementEvidence } from './refinement-evidence';
import Ajv2020 from 'ajv/dist/2020';
import { refinementProviderTask } from './refinement-provider-task';
import { refinementTask, refinementResponse } from './refinement-fixture';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import { validatePacket } from './validate-packet';

it('lowers only the exact fixed refinement schema for Gemini generation', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  const grammar = providerResponseSchema('google/gemini-3.8-flash', task);
  expect(JSON.stringify(grammar)).not.toMatch(/"(?:allOf|\$ref|\$defs)"/);
  const validate = new Ajv2020({
    strict: true,
    validateFormats: false,
  }).compile(grammar);
  expect(validate(refinementResponse)).toBe(true);
  expect(validatePacket('BookRefinementResponse', refinementResponse)).toEqual(
    refinementResponse,
  );
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', {
      ...task,
      responseSchema: {},
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
it('preserves other provider schemas and rejects changed source images', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  expect(providerResponseSchema('other/model', task)).toBe(task.responseSchema);
  expect(() =>
    refinementProviderTask(
      {
        ...refinementTask,
        image: { ...refinementTask.image, sha256: '0'.repeat(64) },
      },
      refinementTask.source_sha256,
    ),
  ).toThrow('SOURCE_MISMATCH');
});

it('requires observed style identity, size and weight in host and Gemini grammar', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  const validate = new Ajv2020({
    strict: true,
    validateFormats: false,
  }).compile(providerResponseSchema('google/gemini-3.8-flash', task));
  const regular = { id: 'observed', relative_size: 1, bold: false };
  const styles: Record<string, unknown>[] = [
    { ...regular, id: 'style-ch1' },
    { ...regular, relative_size: null },
    { ...regular, bold: null },
    { id: 'observed', bold: false },
    { id: 'observed', relative_size: 1 },
    { relative_size: 1, bold: false },
  ];
  for (const style of styles) {
    const response = {
      ...refinementResponse,
      decisions: [{ ...refinementResponse.decisions[0], style }],
    };
    expect(validate(response)).toBe(false);
    expect(() => validatePacket('BookRefinementResponse', response)).toThrow(
      'INVALID_RESULT',
    );
  }
  const response = {
    ...refinementResponse,
    decisions: [{ ...refinementResponse.decisions[0], style: regular }],
  };
  expect(validate(response)).toBe(true);
  expect(validatePacket('BookRefinementResponse', response)).toEqual(response);
});

it('makes each source-bound evidence obligation explicit without changing the schema', () => {
  const task = refinementProviderTask(
    refinementTask,
    refinementTask.source_sha256,
  );
  const message = task.messages[1].content as { type: string; text?: string }[];
  const context = JSON.parse(message[0].text!) as ReturnType<
    typeof refinementEvidence
  >;
  for (const id of refinementTask.decision_ids) {
    const node = refinementTask.nodes.find((n) => n.id === id)!;
    const required = context.required_decision_evidence[id];
    expect(required).toContain(
      refinementTask.crops.find((c) => c.node_id === id && c.part === 'head')!
        .id,
    );
    if (node.body_reference_id)
      expect(required).toContain(
        refinementTask.crops.find(
          (c) => c.node_id === node.body_reference_id && c.part === 'head',
        )!.id,
      );
    expect(
      required.every((cropId: string) =>
        refinementTask.crops.some((c) => c.id === cropId),
      ),
    ).toBe(true);
  }
  for (const edge of refinementTask.edges) {
    expect(context.required_join_evidence[edge.id]).toEqual([
      (refinementTask.crops.find(
        (c) => c.node_id === edge.previous_id && c.part === 'tail',
      ) ??
        refinementTask.crops.find(
          (c) => c.node_id === edge.previous_id && c.part === 'head',
        ))!.id,
      refinementTask.crops.find(
        (c) => c.node_id === edge.next_id && c.part === 'head',
      )!.id,
    ]);
  }
});

it('keeps different references on one page and uses join tails', () => {
  const node = refinementTask.nodes[0];
  const crop = refinementTask.crops[0];
  const task: typeof refinementTask = {
    ...refinementTask,
    nodes: [
      { ...node, id: 'title', body_reference_id: 'before' },
      { ...node, id: 'verse', body_reference_id: 'after' },
      { ...node, id: 'before' },
      { ...node, id: 'after' },
    ],
    decision_ids: ['title', 'verse'],
    edges: [{ id: 'join', previous_id: 'before', next_id: 'after' }],
    crops: [
      { ...crop, id: 'crop-title', node_id: 'title' },
      ...['verse', 'before', 'after'].map((id) => ({
        ...crop,
        id: 'crop-' + id,
        node_id: id,
      })),
      {
        ...crop,
        id: 'crop-before-tail',
        node_id: 'before',
        part: 'tail' as const,
      },
    ],
  };
  expect(refinementEvidence(task)).toEqual({
    required_decision_evidence: {
      title: ['crop-title', 'crop-before'],
      verse: ['crop-verse', 'crop-after'],
    },
    required_join_evidence: { join: ['crop-before-tail', 'crop-after'] },
  });
});
