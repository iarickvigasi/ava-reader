// Only failures from the trusted host exchange callback retain their domain identity.
export class ExchangeFailure extends Error {
  constructor(readonly original: Error) {
    super('HOST_EXCHANGE_FAILED');
  }
}
