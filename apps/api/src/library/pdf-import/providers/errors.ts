export class PdfProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PdfProviderError';
  }
}
