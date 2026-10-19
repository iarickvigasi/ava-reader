import type { ReconstructionReport } from './generated/ReconstructionReport';
import { SOURCE_CONTINUATION_POLICY } from '../../library/pdf-import/admission/profile';

export function reportMatchesCapturedPolicy(
  report: ReconstructionReport,
  continuationPolicy: unknown,
) {
  return (
    report.schema_version !== 'ava-reconstruction-report-3' ||
    (continuationPolicy === SOURCE_CONTINUATION_POLICY &&
      report.source_continuation_policy === continuationPolicy)
  );
}
