import { PdfProviderError } from './errors';
import type { ProviderFailureDiagnostic } from './http-failure-diagnostic';
const privateReceipts = new WeakMap<Error, Buffer>();
const diagnostics = new WeakMap<Error, ProviderFailureDiagnostic>();
export class ProviderTransportFailure extends PdfProviderError {
  constructor(receipt: Buffer, diagnostic?: ProviderFailureDiagnostic) {
    super('PDF_PROVIDER_TRANSPORT_UNCERTAIN');
    privateReceipts.set(this, Buffer.from(receipt));
    if (diagnostic) diagnostics.set(this, structuredClone(diagnostic));
  }
}
// Explicit private persistence only; error enumeration/logging cannot reveal provider text.
export function privateTransportReceipt(error: unknown): Buffer | undefined {
  const receipt =
    error instanceof Error ? privateReceipts.get(error) : undefined;
  return receipt ? Buffer.from(receipt) : undefined;
}

export function providerFailureDiagnostic(
  error: unknown,
): ProviderFailureDiagnostic | undefined {
  const diagnostic =
    error instanceof Error ? diagnostics.get(error) : undefined;
  return diagnostic ? structuredClone(diagnostic) : undefined;
}
