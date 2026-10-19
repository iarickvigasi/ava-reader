import taskFixture from './fixtures/source-role-task.json';
import responseFixture from './fixtures/source-role-response.json';
import type { SourceRoleTask } from './generated/SourceRoleTask';
import { SOURCE_ROLE_PROMPT } from './generated/source-role-prompt';
import { refinementProviderTask } from './refinement-provider-task';
import { refinementResponse } from './refinement-response';
import { validateRefinementBatch } from './refinement-packets';
import { validatePacket } from './validate-packet';

const task = taskFixture as SourceRoleTask;

describe('current source role authority', () => {
  it('uses its exact role-only prompt, shared page, own local evidence and normal source image binding', () => {
    const provider = refinementProviderTask(task, task.source_sha256);
    expect(provider.promptVersion).toBe('ava-book-refinement-9');
    expect(provider.schemaVersion).toBe('ava-book-refinement-response-6');
    expect(provider.messages[0].content).toBe(SOURCE_ROLE_PROMPT);
    expect(provider.pageIndices).toEqual([task.page - 1]);
    const body = provider.messages[1].content as {
      type: string;
      text?: string;
    }[];
    const context = JSON.parse(body[0].text!) as {
      required_role_evidence: Record<string, string[]>;
    };
    expect(context.required_role_evidence[task.nodes[0].id]).toEqual([
      'role-page',
      'role-local-1',
    ]);
    expect(context).not.toHaveProperty('required_feature_evidence');
    expect(context).not.toHaveProperty('body_reference_id');
    expect(refinementResponse(task, JSON.stringify(responseFixture))).toEqual(
      responseFixture,
    );
    expect(() => refinementProviderTask(task, 'b'.repeat(64))).toThrow();
    const changed = structuredClone(task);
    changed.image.base64 = 'AAAA';
    expect(() => refinementProviderTask(changed, task.source_sha256)).toThrow();
  });

  it('admits the tagged task only to the current continuation batch', () => {
    const current = {
      schema_version: 'ava-book-refinement-batch-4',
      source_sha256: task.source_sha256,
      source_title_policy: 'ava-frontmatter-title-1',
      source_continuation_policy: 'ava-source-continuation-presentation-1',
      tasks: [task],
    };
    expect(validateRefinementBatch(current)).toEqual(current);
    for (const version of [1, 2, 3]) {
      expect(() =>
        validateRefinementBatch({
          ...current,
          schema_version: `ava-book-refinement-batch-${version}`,
        }),
      ).toThrow();
    }
    expect(() => validatePacket('SourceFeatureTask', task)).toThrow();
    expect(() =>
      validatePacket('SourceFeatureResponse', responseFixture),
    ).toThrow();
  });

  it('rejects text/style/join/chapter authority and wrong role values before semantic validation', () => {
    for (const extra of [
      { text: 'rewrite' },
      { styles: [] },
      { joins: [] },
      { chapter_start: true },
    ])
      expect(() =>
        refinementResponse(
          task,
          JSON.stringify({ ...responseFixture, ...extra }),
        ),
      ).toThrow();
    const wrong = structuredClone(responseFixture);
    wrong.role_decisions[0].role = 'heading';
    expect(() => refinementResponse(task, JSON.stringify(wrong))).toThrow();
  });
});
