import type { PrismaService } from '../../../prisma/prisma.service';
import type { ProviderDispatch, ProviderTransport } from './types';
import { dispatchPdfProviderReceipt } from './dispatch-receipt';
import { decodeProviderReceipt } from './recognition-observation-output';
import { prepareFigureAltRepair } from './figure-alt-repair';

export async function dispatchPdfProvider(
  prisma: PrismaService,
  input: ProviderDispatch,
  testTransport?: ProviderTransport,
) {
  const snapshot = {
    ...input,
    authority: { ...input.authority },
    task: structuredClone(input.task),
  };
  const { receipt, prepared } = await dispatchPdfProviderReceipt(
    prisma,
    snapshot,
    testTransport,
  );
  try {
    return decodeProviderReceipt(receipt, prepared.decodeOutput);
  } catch (originalError) {
    if (!prepared.decodeOutput) throw originalError;
    let repair: ReturnType<typeof prepareFigureAltRepair>;
    try {
      repair = prepareFigureAltRepair(
        snapshot.task,
        receipt.output,
        { callId: receipt.callId, requestSha256: prepared.requestSha256 },
        prepared.decodeOutput,
      );
    } catch {
      throw originalError;
    }
    // Exactly one additional call. Static prompt/schema must be explicitly allowlisted
    // on the route; request count, budgets, deletion, cancellation and uncertain holds
    // remain enforced. No recursive repair, fallback, or retry of a terminal operation.
    const corrected = await dispatchPdfProviderReceipt(
      prisma,
      { ...snapshot, task: repair.task },
      testTransport,
    );
    return {
      ...receipt,
      output: repair.apply(corrected.receipt.output),
      repairReused: corrected.receipt.reused,
      repairCallId: corrected.receipt.callId,
    };
  }
}
