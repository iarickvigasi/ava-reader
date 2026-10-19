import { reportMatchesCapturedPolicy } from './report-policy';
import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { artifactStream } from '../runtime/artifact-stream';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { parsePacket, validatePacket } from './validate-packet';
import type { ReconstructionReport } from './generated/ReconstructionReport';
import type { CoordinatorDependencies } from './coordinator-types';

export function reconstructionSink(
  deps: CoordinatorDependencies,
  checkActive: () => void,
  semantic: SemanticValidator,
  continuationPolicy?: string,
) {
  const stagedByPath: Record<string, string> = {};
  let book: CanonicalBookV2 | undefined,
    reportBytes: ReconstructionReport | undefined;
  const sink = artifactStream(async (descriptor, bytes) => {
    checkActive();
    if (descriptor.path === 'canonical.json')
      book = await validateContract('ava-book-2', bytes, semantic);
    if (descriptor.path === 'reconstruction-report.json') {
      reportBytes = parsePacket('ReconstructionReport', bytes, 8 * 1024 ** 2);
      if (!reportMatchesCapturedPolicy(reportBytes, continuationPolicy))
        throw new PdfRuntimeError('INVALID_RESULT');
    }
    checkActive();
    stagedByPath[descriptor.path] = await deps.stageArtifact(descriptor, bytes);
    checkActive();
  });
  return {
    write: (chunk: Buffer) => sink.write(chunk),
    finish() {
      const header = sink.finish();
      const report = validatePacket('ReconstructionReport', header.report);
      if (
        !reportMatchesCapturedPolicy(report, continuationPolicy) ||
        !book ||
        !reportBytes ||
        JSON.stringify(reportBytes) !== JSON.stringify(report)
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      return { stagedByPath, book, reportBytes, header, report };
    },
  };
}
