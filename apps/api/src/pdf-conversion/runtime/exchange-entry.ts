import {
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
  FRONTMATTER_TITLE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
} from '../../library/pdf-import/admission/profile';
import { capturedSourcePolicies } from '../../library/pdf-import/admission/captured-source-policies';
import type { SandboxInput } from './container-arguments';
import { exchangeJson } from './exchange-json';
import { PdfRuntimeError } from './runtime-error';
import { initialExchangeInput } from './initial-exchange-input';

export function exchangeEntry(input: SandboxInput) {
  if (!input.onExchange) return false;
  try {
    if (
      input.module !== 'ava_pdf_epub.reconstruction_v2' ||
      typeof input.onStdout !== 'function' ||
      typeof input.onExchange !== 'function' ||
      !input.auxiliaryBytes ||
      !input.jobBytes
    )
      throw new Error('Exchange entry');
    const value = exchangeJson(input.auxiliaryBytes) as Record<string, unknown>;
    if (
      !value ||
      Object.keys(value).sort().join() !== 'input,mode' ||
      value.mode !== 'attempt_stream'
    )
      throw new Error('Exchange mode');
    const request = initialExchangeInput(value.input);
    const job = exchangeJson(input.jobBytes) as {
      source?: { sha256?: unknown };
      profile_id?: unknown;
      config_sha256?: unknown;
    };
    if (
      job?.source?.sha256 !== request.source_sha256 ||
      job.profile_id !== request.profile_id
    )
      throw new Error('Exchange job binding');
    const {
      sourceLayoutPolicy: layout,
      sourceStructurePolicy: native,
      sourceNormalizationPolicy: wrap,
      recognitionRepairPolicy: repair,
      sourceTitlePolicy: title,
    } = capturedSourcePolicies(request.profile_id, job.config_sha256);
    if (
      request.schema_version !== 'ava-reconstruct-input-7' &&
      title !== undefined
    )
      throw new Error('Exchange title policy binding');
    if (
      request.schema_version === 'ava-reconstruct-input-7'
        ? layout !== NATIVE_LAYOUT_POLICY ||
          native !== NATIVE_STRUCTURE_POLICY ||
          wrap !== NATIVE_WORD_WRAP_POLICY ||
          repair !== RECOGNITION_GEOMETRY_REPAIR_POLICY ||
          title !== FRONTMATTER_TITLE_POLICY
        : request.schema_version === 'ava-reconstruct-input-6'
          ? layout !== NATIVE_LAYOUT_POLICY ||
            native !== NATIVE_STRUCTURE_POLICY ||
            wrap !== NATIVE_WORD_WRAP_POLICY ||
            repair !== RECOGNITION_GEOMETRY_REPAIR_POLICY
          : request.schema_version === 'ava-reconstruct-input-5'
            ? layout !== NATIVE_LAYOUT_POLICY ||
              native !== NATIVE_STRUCTURE_POLICY ||
              wrap !== NATIVE_WORD_WRAP_POLICY ||
              repair !== undefined
            : request.schema_version === 'ava-reconstruct-input-4'
              ? layout !== NATIVE_LAYOUT_POLICY ||
                native !== NATIVE_STRUCTURE_POLICY ||
                wrap !== undefined
              : request.schema_version === 'ava-reconstruct-input-3'
                ? layout !== NATIVE_LAYOUT_POLICY || native !== undefined
                : layout !== undefined || native !== undefined
    )
      throw new Error('Exchange policy binding');
    return true;
  } catch {
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  }
}
