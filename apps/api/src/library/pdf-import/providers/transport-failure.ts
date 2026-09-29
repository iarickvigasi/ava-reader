import { PdfProviderError } from './errors';
const privateReceipts = new WeakMap<Error, Buffer>();
export class ProviderTransportFailure extends PdfProviderError {
  constructor(receipt: Buffer) {
    super('PDF_PROVIDER_TRANSPORT_UNCERTAIN');
    privateReceipts.set(this, Buffer.from(receipt));
  }
}
// Explicit private persistence only; error enumeration/logging cannot reveal provider text.
export function privateTransportReceipt(error: unknown): Buffer | undefined {
  const receipt =
    error instanceof Error ? privateReceipts.get(error) : undefined;
  return receipt ? Buffer.from(receipt) : undefined;
}
