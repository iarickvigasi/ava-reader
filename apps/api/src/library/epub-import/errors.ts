export class InvalidImportedEpub extends Error {}
export class EpubLeaseExpired extends Error {
  readonly code = 'LEASE_EXPIRED';
  constructor() {
    super('LEASE_EXPIRED');
  }
}
export class EpubHeartbeatUnavailable extends Error {
  readonly code = 'HEARTBEAT_UNAVAILABLE';
  constructor() {
    super('HEARTBEAT_UNAVAILABLE');
  }
}
