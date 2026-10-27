import { APPLY_BATCH_SIZE, APPLY_TRANSACTION_SIZE } from './types';

export function batchSettings(env: NodeJS.ProcessEnv = process.env) {
  return {
    readSize: integer(env, 'CATALOG_IMPORT_READ_SIZE', APPLY_BATCH_SIZE, 500),
    transactionSize: integer(
      env,
      'CATALOG_IMPORT_TRANSACTION_SIZE',
      APPLY_TRANSACTION_SIZE,
      250,
    ),
    readBytes: integer(
      env,
      'CATALOG_IMPORT_READ_BYTES',
      8 * 1024 * 1024,
      64 * 1024 * 1024,
    ),
    transactionBytes: integer(
      env,
      'CATALOG_IMPORT_TRANSACTION_BYTES',
      4 * 1024 * 1024,
      16 * 1024 * 1024,
    ),
  };
}
export type BatchSettings = ReturnType<typeof batchSettings>;

function integer(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  max: number,
) {
  const value = env[key];
  if (value === undefined) return fallback;
  const number = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > max
  )
    throw new Error(`${key} must be an integer between 1 and ${max}`);
  return number;
}
