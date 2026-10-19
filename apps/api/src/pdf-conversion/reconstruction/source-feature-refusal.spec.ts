import { validateRefinement } from './validate-refinement';
import {
  featureTask,
  featureResponse,
} from './source-feature-contract-fixture';
import { SourceContentError } from './source-refusal';
import type { CoordinatorDependencies } from './coordinator-types';

it('retains exact source-linked essential refusal from stock validation, without source text', async () => {
  const q = featureTask.source_features[0];
  const diagnostic = {
    schema_version: 'ava-source-refusal-1',
    source_sha256: featureTask.source_sha256,
    stage: 'assembly',
    findings: [
      {
        code: 'ESSENTIAL_STRUCTURE_UNSUPPORTED',
        severity: 'blocking',
        page: q.page,
        box: q.source_box,
        region_box: q.column_box,
        block_id: q.node_id,
        segment_id_sha256: null,
        task_id: featureTask.task_id,
        render_sha256: featureTask.crops[0].render_sha256,
      },
    ],
  };
  const sandbox: CoordinatorDependencies['sandbox'] = () =>
    Promise.resolve({
      exitCode: 1,
      stdout: Buffer.from(JSON.stringify(diagnostic)),
      faultAcknowledged: false,
      faultAcknowledgement: undefined,
    });
  const promise = validateRefinement(
    featureTask,
    featureResponse,
    sandbox,
    () => ({
      module: 'ava_pdf_epub.reconstruction_v2',
      source: Buffer.alloc(0),
      deadlineMs: 1000,
      scratchBytes: 1000,
    }),
  );
  await expect(promise).rejects.toBeInstanceOf(SourceContentError);
  try {
    await promise;
  } catch (error) {
    expect((error as SourceContentError).diagnostic()).toEqual(diagnostic);
    expect(
      JSON.stringify((error as SourceContentError).diagnostic()),
    ).not.toContain('text_excerpt');
  }
});
