export class JobAuthorityError extends Error {
  readonly code = 'PDF_JOB_AUTHORITY_INVALID';
  constructor() {
    super('PDF_JOB_AUTHORITY_INVALID');
  }
}
export class PdfJobError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
