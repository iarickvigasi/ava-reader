import { createHash } from 'node:crypto';
import { reportId } from './event-contract';

export type ReportCall = {
  id: string;
  state: string;
  reservedNano: bigint;
  actualNano: bigint | null;
  requestSha256: string;
  receiptSha256: string | null;
  providerGenerationId: string | null;
  modelId: string;
  routeProvider: string;
  routeId: string;
  tariffSha256: string;
  configurationSha256: string;
  purpose: string | null;
  stage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
};

export function projectConversionCost(calls: ReportCall[], terminal: boolean) {
  const sorted = [...calls].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(sorted.map((call) => call.id)).size !== sorted.length)
    throw new Error('PDF_COST_DUPLICATE_CALL');
  const builder = new CostProjectionBuilder({
    offset: 0,
    limit: sorted.length,
  });
  for (const call of sorted) builder.add(call);
  return builder.finish(terminal);
}

// Ordered database batches retain only the requested details page. All calls
// still contribute to exact totals and the same deterministic watermark.
export class CostProjectionBuilder {
  private actual = 0n;
  private reserved = 0n;
  private uncertain = 0n;
  private complete = true;
  private count = 0;
  private lastId: string | null = null;
  private readonly hash = createHash('sha256').update('[');
  private readonly calls: ReturnType<typeof itemize>[] = [];
  private readonly groups = new Map<
    string,
    {
      modelId: string;
      routeProvider: string;
      stage: string | null;
      knownActualNano: bigint;
      reservedNano: bigint;
      uncertainNano: bigint;
      calls: number;
    }
  >();
  constructor(private readonly page: { offset: number; limit: number }) {}
  add(call: ReportCall) {
    if (this.lastId === call.id) throw new Error('PDF_COST_DUPLICATE_CALL');
    this.lastId = call.id;
    if (
      call.reservedNano < 0n ||
      (call.actualNano !== null && call.actualNano < 0n)
    )
      throw new Error('PDF_COST_NEGATIVE_AMOUNT');
    if (call.state === 'SETTLED') {
      if (call.actualNano === null) this.complete = false;
      else this.actual += call.actualNano;
      if (!call.receiptSha256 || !call.providerGenerationId)
        this.complete = false;
    } else if (['RESERVED', 'DISPATCHING'].includes(call.state))
      this.reserved += call.reservedNano;
    else if (call.state === 'UNCERTAIN') this.uncertain += call.reservedNano;
    else if (call.state !== 'RELEASED') this.complete = false;
    const safe = itemize(call);
    if (
      safe.id === null ||
      safe.modelId === 'UNAVAILABLE' ||
      safe.routeProvider === 'UNAVAILABLE' ||
      (call.state === 'SETTLED' &&
        (safe.receiptSha256 === null || safe.providerGenerationId === null))
    )
      this.complete = false;
    if (this.count) this.hash.update(',');
    this.hash.update(JSON.stringify(safe));
    if (
      this.count >= this.page.offset &&
      this.count < this.page.offset + this.page.limit
    )
      this.calls.push(safe);
    this.count++;
    const key = JSON.stringify([safe.modelId, safe.routeProvider, safe.stage]);
    const group = this.groups.get(key) ?? {
      modelId: safe.modelId,
      routeProvider: safe.routeProvider,
      stage: safe.stage,
      knownActualNano: 0n,
      reservedNano: 0n,
      uncertainNano: 0n,
      calls: 0,
    };
    group.calls++;
    if (call.state === 'SETTLED' && call.actualNano !== null)
      group.knownActualNano += call.actualNano;
    if (['RESERVED', 'DISPATCHING'].includes(call.state))
      group.reservedNano += call.reservedNano;
    if (call.state === 'UNCERTAIN') group.uncertainNano += call.reservedNano;
    this.groups.set(key, group);
  }
  finish(terminal: boolean, historyComplete = true) {
    this.complete &&= historyComplete;
    const actualComplete =
      this.complete &&
      terminal &&
      this.reserved === 0n &&
      this.uncertain === 0n;
    return {
      version: 1,
      currency: 'USD',
      knownActualNano: this.actual.toString(),
      reservedNano: this.reserved.toString(),
      uncertainNano: this.uncertain.toString(),
      heldExposureNano: (this.reserved + this.uncertain).toString(),
      actualComplete,
      state: !this.complete
        ? 'INCOMPLETE'
        : actualComplete
          ? 'FINAL'
          : 'PROVISIONAL',
      infrastructure: {
        compute: 'NOT_MEASURED',
        storage: 'NOT_MEASURED',
        delivery: 'NOT_MEASURED',
      },
      estimatedNano: null,
      estimateStatus: 'NOT_AVAILABLE',
      ledgerCoverage: historyComplete
        ? 'VERIFIED_CURRENT_LEDGER'
        : 'HISTORY_UNAVAILABLE',
      breakdown: [...this.groups.values()].map((group) => ({
        modelId: group.modelId,
        routeProvider: group.routeProvider,
        stage: group.stage,
        calls: group.calls,
        knownActualNano: group.knownActualNano.toString(),
        reservedNano: group.reservedNano.toString(),
        uncertainNano: group.uncertainNano.toString(),
      })),
      calls: this.calls,
      callCount: this.count,
      ledgerWatermark: this.hash.update(']').digest('hex'),
    };
  }
}

function itemize(call: ReportCall) {
  return {
    id: safeReference(call.id),
    state: [
      'SETTLED',
      'RESERVED',
      'DISPATCHING',
      'UNCERTAIN',
      'RELEASED',
    ].includes(call.state)
      ? call.state
      : 'UNKNOWN',
    requestSha256: safeDigest(call.requestSha256),
    receiptSha256: safeDigest(call.receiptSha256),
    providerGenerationId: safeReference(call.providerGenerationId),
    modelId:
      typeof call.modelId === 'string' &&
      /^[A-Za-z0-9_./:-]{1,200}$/.test(call.modelId) &&
      !/^(?:sk[-_]|bearer)/i.test(call.modelId)
        ? call.modelId
        : 'UNAVAILABLE',
    routeProvider:
      typeof call.routeProvider === 'string' &&
      /^[A-Za-z0-9_-]{1,80}$/.test(call.routeProvider)
        ? call.routeProvider
        : 'UNAVAILABLE',
    routeId: safeReference(call.routeId),
    tariffSha256: safeDigest(call.tariffSha256),
    configurationSha256: safeDigest(call.configurationSha256),
    purpose: ['transcribe_region', 'resolve_structure'].includes(
      call.purpose ?? '',
    )
      ? call.purpose
      : null,
    stage:
      typeof call.stage === 'string' && /^[A-Z_]{1,40}$/.test(call.stage)
        ? call.stage
        : null,
    promptTokens: safeCount(call.promptTokens),
    completionTokens: safeCount(call.completionTokens),
    reservedNano: call.reservedNano.toString(),
    actualNano: call.actualNano?.toString() ?? null,
    observedProvider: null,
  };
}
function safeReference(value: unknown) {
  return reportId.safeParse(value).success ? (value as string) : null;
}
function safeDigest(value: unknown) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    ? value
    : null;
}
function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
