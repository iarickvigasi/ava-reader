import { ContractError } from './contract-error';

export const MAX_CONTRACT_BYTES = 32 * 1024 * 1024;
export function parseContractJson(bytes: Buffer): unknown {
  if (bytes.length > MAX_CONTRACT_BYTES)
    throw new ContractError('INVALID_CONTRACT');
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new ContractError('INVALID_CONTRACT');
  }
}
