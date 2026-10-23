import type { Prisma } from '#catalog-client';

export const ADAPTER_VERSION = 1;
export const STAGE_BATCH_SIZE = 100;
export const MAX_STAGE_BATCH_BYTES = 4 * 1024 * 1024;
export const APPLY_BATCH_SIZE = 50;
export const MAX_LINE_BYTES = 8 * 1024 * 1024;
export const IMPORT_LOCK = 78412031;
export const SOURCE_KEY = 'open-library';
export const KINDS = ['AUTHOR', 'WORK', 'EDITION'] as const;
export type Kind = (typeof KINDS)[number];
export type Raw = Record<string, unknown>;
export type Tx = Prisma.TransactionClient;
export type DumpRecord = {
  kind: Kind;
  externalId: string;
  revision: number;
  modifiedAt: Date;
  payloadHash: string;
  payload: Prisma.InputJsonObject;
};
export class ChangedInput extends Error {}
export class InvalidRecord extends Error {}
export class UnresolvedRecord extends Error {}
export class ConflictingRecord extends Error {}

export {
  ImportRecordStatus as RecordStatus,
  ImportStatus as RunStatus,
} from '#catalog-client';
