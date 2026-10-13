import {
  capturedSourceLayoutPolicy,
  capturedSourceStructurePolicy,
  capturedSourceNormalizationPolicy,
  NATIVE_WORD_WRAP_POLICY,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
} from '../../library/pdf-import/admission/profile';
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
    const layout = capturedSourceLayoutPolicy(
      request.profile_id,
      job.config_sha256,
    );
    const native = capturedSourceStructurePolicy(
      request.profile_id,
      job.config_sha256,
    );
    const wrap = capturedSourceNormalizationPolicy(
      request.profile_id,
      job.config_sha256,
    );
    if (
      request.schema_version === 'ava-reconstruct-input-5'
        ? layout !== NATIVE_LAYOUT_POLICY ||
          native !== NATIVE_STRUCTURE_POLICY ||
          wrap !== NATIVE_WORD_WRAP_POLICY
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
