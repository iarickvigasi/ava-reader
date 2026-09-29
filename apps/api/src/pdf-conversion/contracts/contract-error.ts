export class ContractError extends Error {
  constructor(
    readonly code:
      | 'INVALID_CONTRACT'
      | 'UNSUPPORTED_SCHEMA'
      | 'VALIDATOR_UNAVAILABLE',
  ) {
    super(code);
    this.name = 'ContractError';
  }
}
