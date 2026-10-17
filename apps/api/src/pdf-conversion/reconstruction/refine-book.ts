import type { NativeLayoutPolicy } from '../../library/pdf-import/admission/profile';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import {
  type RefinementResponse,
  parseRefinementBatch,
} from './refinement-packets';
import { refinementResponse } from './refinement-response';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { refinementProviderTask } from './refinement-provider-task';
import { validateRefinement } from './validate-refinement';
import { parseSourceRefusal } from './source-refusal';

export async function refineBook(input: {
  responses: RecognitionResponse[];
  sourceSha256: string;
  providerMode: string;
  profileId?: RecognitionTask['profile_id'];
  sourceLayoutPolicy?: NativeLayoutPolicy;
  deps: CoordinatorDependencies;
  sandboxInput: () => SandboxInput;
}): Promise<RefinementResponse[]> {
  // Native text can still contain unresolved same-font chapter/list roles.
  // The source comparison stage returns no tasks for already-qualified structure.
  if (input.sourceLayoutPolicy !== undefined)
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({
      mode: 'prepare_refinement',
      input: {
        schema_version: 'ava-reconstruct-input-1',
        source_feature_policy: 'ava-ocr-source-features-1',
        profile_id: input.profileId ?? 'ava-pdf-prose-en-v2',
        source_sha256: input.sourceSha256,
        responses: input.responses,
      },
    }),
  );
  if (auxiliaryBytes.length > 64 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const prepared = await input.deps.sandbox({
    ...input.sandboxInput(),
    observationCommand: { command: 'prepare_refinement', page_number: null },
    auxiliaryBytes,
  });
  if (prepared.exitCode === 1)
    throw parseSourceRefusal(prepared.stdout, input.sourceSha256);
  if (prepared.exitCode !== 0) throw new PdfRuntimeError('INVALID_RESULT');
  const batch = parseRefinementBatch(prepared.stdout, 24 * 1024 ** 2);
  if (
    batch.schema_version === 'ava-book-refinement-batch-3' ||
    batch.schema_version === 'ava-book-refinement-batch-4'
  )
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  if (
    batch.source_sha256 !== input.sourceSha256 ||
    batch.tasks.some(
      (task) => task.profile_id !== (input.profileId ?? 'ava-pdf-prose-en-v2'),
    )
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (batch.tasks.length && input.providerMode === 'native')
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  const seen = new Set<string>(),
    responses: RefinementResponse[] = [];
  for (const task of batch.tasks) {
    if (seen.has(task.task_id)) throw new PdfRuntimeError('INVALID_RESULT');
    seen.add(task.task_id);
    await validateRefinement(
      task,
      null,
      input.deps.sandbox,
      input.sandboxInput,
    );
    input.sandboxInput();
    const receipt = await input.deps.dispatch(
      refinementProviderTask(task, input.sourceSha256),
    );
    const response = refinementResponse(task, receipt.output);
    await validateRefinement(
      task,
      response,
      input.deps.sandbox,
      input.sandboxInput,
    );
    responses.push(response);
  }
  return responses;
}
