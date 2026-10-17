export class PdfPublicationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PdfPublicationError';
  }
}
