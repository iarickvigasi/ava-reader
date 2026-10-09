import type { PrismaService } from '../../../prisma/prisma.service';
import type { AttemptAuthority } from '../jobs';
import type { ProviderTask } from './types';
import { jobTransaction } from '../jobs/transaction';
import { costLock } from './cost-lock';
import { loadProviderGrant } from './load-grant';
import { prepareProviderRequest } from './prepare-request';
import { allocateProviderBudgets } from './allocate';
import { fenceAbandonedProviderDispatch } from './recover-dispatch';
import { PdfProviderError } from './errors';
import { requirePilotCall } from './pilot-authority';
import { recordPdfProviderEvent } from '../reports/provider-event';
export async function reservePdfProvider(
  prisma: PrismaService,
  authority: AttemptAuthority,
  task: ProviderTask,
) {
  const credential = { ...authority },
    snapshot = structuredClone(task);
  const initial = await jobTransaction(prisma, async (tx) => {
    const scope = await loadProviderGrant(tx, credential, false);
    await costLock(tx);
    await fenceAbandonedProviderDispatch(
      tx,
      scope.grant.id,
      scope.grant.routeId,
      scope.attempt.id,
    );
    return scope;
  });
  const prepared = prepareProviderRequest(initial.grant.route, snapshot);
  return jobTransaction(prisma, async (tx) => {
    const scope = await loadProviderGrant(tx, credential, false);
    await costLock(tx);
    const { grant, job, attempt } = scope;
    if (
      snapshot.sourceSha256 !== job.source.sha256 ||
      snapshot.pageIndices.some((p) => p >= job.source_page_limit)
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
    requirePilotCall(prepared.config, job.operation_id, {
      taskId: snapshot.taskId,
      taskSha256: prepared.taskSha256,
      requestSha256: prepared.requestSha256,
    });
    const previous = await tx.pdfProviderCall.findUnique({
      where: { grantId_taskId: { grantId: grant.id, taskId: snapshot.taskId } },
    });
    if (previous) {
      if (
        previous.requestSha256 !== prepared.requestSha256 ||
        previous.taskSha256 !== prepared.taskSha256
      )
        throw new PdfProviderError('PDF_PROVIDER_REQUEST_CONFLICT');
      await loadProviderGrant(tx, credential, false);
      return { call: previous, prepared, grant };
    }
    await loadProviderGrant(tx, credential);
    if (
      prepared.config.importPolicy &&
      (await tx.pdfProviderCall.count({ where: { grantId: grant.id } })) >=
        prepared.config.importPolicy.maxRequestsPerOperation
    )
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_LIMIT');
    const call = await tx.pdfProviderCall.create({
      data: {
        grantId: grant.id,
        taskId: snapshot.taskId,
        requestSha256: prepared.requestSha256,
        taskSha256: prepared.taskSha256,
        promptVersion: snapshot.promptVersion,
        schemaVersion: snapshot.schemaVersion,
        reservedAttemptId: attempt.id,
        reservedNano: prepared.maximumNano,
        accountKey: grant.route.accountKey,
      },
    });
    await allocateProviderBudgets(
      tx,
      grant.budgetIds,
      call.id,
      prepared.maximumNano,
    );
    await recordPdfProviderEvent(tx, {
      data: {
        callId: call.id,
        kind: 'RESERVED',
        evidenceSha256: prepared.requestSha256,
        details: {
          attemptId: attempt.id,
          maximumNano: prepared.maximumNano.toString(),
          purpose: snapshot.purpose,
          pageIndices: snapshot.pageIndices,
          stage: scope.attempt.job.operation.stage,
        },
      },
    });
    await loadProviderGrant(tx, credential);
    return { call, prepared, grant };
  });
}
