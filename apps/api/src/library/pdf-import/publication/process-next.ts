import { processCandidate } from './process-candidate';

export async function processNextCandidate(
  ...args: [
    Parameters<typeof processCandidate>[0],
    Parameters<typeof processCandidate>[1],
    Parameters<typeof processCandidate>[2],
  ]
) {
  const skipped: string[] = [];
  let last: Awaited<ReturnType<typeof processCandidate>> | undefined;
  for (let i = 0; i < 100; i += 1) {
    const result = await processCandidate(...args, skipped);
    if (result.kind === 'idle') return last ?? result;
    if (result.kind !== 'waiting_reader' && result.kind !== 'waiting_review')
      return result;
    if (!('operationId' in result)) return result;
    skipped.push(result.operationId);
    last = result;
  }
  return last!;
}
