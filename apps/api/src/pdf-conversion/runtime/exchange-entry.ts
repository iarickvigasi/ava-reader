import {
  capturedSourceLayoutPolicy,
  NATIVE_LAYOUT_POLICY,
} from '../../library/pdf-import/admission/profile';
import type { SandboxInput } from './container-arguments';
import { exchangeJson } from './exchange-json';
import { PdfRuntimeError } from './runtime-error';

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
    const request = value.input as Record<string, unknown>;
    const job = exchangeJson(input.jobBytes) as {
      source?: { sha256?: unknown };
      profile_id?: unknown;
      config_sha256?: unknown;
    };
    const current = request?.schema_version === 'ava-reconstruct-input-3';
    if (
      !request ||
      typeof request !== 'object' ||
      Array.isArray(request) ||
      Object.keys(request).some(
        (key) =>
          ![
            'schema_version',
            'profile_id',
            'source_sha256',
            'source_feature_policy',
            'source_layout_policy',
            'responses',
            'refinements',
          ].includes(key),
      ) ||
      (!current && request.schema_version !== 'ava-reconstruct-input-1') ||
      !['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'].includes(
        request.profile_id as string,
      ) ||
      typeof request.source_sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(request.source_sha256) ||
      (request.source_feature_policy !== undefined &&
        request.source_feature_policy !== 'ava-ocr-source-features-1') ||
      !Array.isArray(request.responses) ||
      request.responses.length ||
      !Array.isArray(request.refinements) ||
      request.refinements.length
    )
      throw new Error('Exchange input');
    if (
      job?.source?.sha256 !== request.source_sha256 ||
      job.profile_id !== request.profile_id
    )
      throw new Error('Exchange job binding');
    const policy = capturedSourceLayoutPolicy(
      request.profile_id as string,
      job.config_sha256,
    );
    if (
      current
        ? policy !== NATIVE_LAYOUT_POLICY ||
          request.source_layout_policy !== policy ||
          request.source_feature_policy !== 'ava-ocr-source-features-1'
        : policy !== undefined || Object.hasOwn(request, 'source_layout_policy')
    )
      throw new Error('Exchange policy binding');
    return true;
  } catch {
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  }
}
