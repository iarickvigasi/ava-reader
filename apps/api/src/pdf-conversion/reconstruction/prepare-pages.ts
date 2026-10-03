import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { CoordinatorDependencies } from './coordinator-types';
import type { SandboxInput } from '../runtime/container-arguments';
import { parsePacket } from './validate-packet';
import { providerTask } from './provider-task';
import { validateRecognitionTasks } from './validate-tasks';
import { recognitionResponse } from './recognition-response';
import { PdfRuntimeError } from '../runtime/runtime-error';

export async function preparePages(input: {
  deps: CoordinatorDependencies;
  sandboxInput: () => SandboxInput;
  sourceSha256: string;
  pageLimit: number;
  providerMode: string;
  profileId?: RecognitionTask['profile_id'];
}) {
  const profileId = input.profileId ?? 'ava-pdf-prose-en-v2';
  const responses: RecognitionResponse[] = [],
    taskIds = new Set<string>();
  let pages = input.pageLimit,
    responseBytes = 0;
  for (let page = 1; page <= pages; page++) {
    const result = await input.deps.sandbox({
      ...input.sandboxInput(),
      auxiliaryBytes: Buffer.from(
        JSON.stringify({
          mode: 'prepare',
          page_number: page,
          profile_id: profileId,
        }),
      ),
    });
    if (result.exitCode !== 0) throw new PdfRuntimeError('INVALID_RESULT');
    const prepared = parsePacket('PrepareResult', result.stdout, 8 * 1024 ** 2);
    if (
      (prepared.profile_id ?? 'ava-pdf-prose-en-v2') !== profileId ||
      prepared.tasks.some((task) => task.profile_id !== profileId) ||
      prepared.source_sha256 !== input.sourceSha256 ||
      prepared.page_number !== page ||
      prepared.source_page_count > input.pageLimit ||
      (page > 1 && prepared.source_page_count !== pages)
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    pages = prepared.source_page_count;
    if (prepared.tasks.length) {
      if (input.providerMode === 'native')
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      await validateRecognitionTasks(
        prepared.tasks,
        input.deps.sandbox,
        input.sandboxInput,
      );
    }
    for (const task of prepared.tasks) {
      if (taskIds.has(task.task_id))
        throw new PdfRuntimeError('INVALID_RESULT');
      taskIds.add(task.task_id);
      const mapped = providerTask(task, input.sourceSha256, page);
      input.sandboxInput(); // Recheck shared deadline and cancellation before paid work.
      const receipt = await input.deps.dispatch(mapped);
      const response = recognitionResponse(task, receipt.output);
      await validateRecognitionTasks(
        [task],
        input.deps.sandbox,
        input.sandboxInput,
        [response],
      );
      responseBytes += Buffer.byteLength(JSON.stringify(response)) + 1;
      if (responseBytes > 60 * 1024 ** 2)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      responses.push(response);
    }
    await input.deps.progress({
      stage: 'EXTRACTION',
      completed: page,
      total: pages,
    });
  }
  return { responses, pageCount: pages, taskCount: taskIds.size };
}
