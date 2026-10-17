import { ContractError } from './contract-error';
import { parseContractJson } from './parse-json';
import { validateStructure } from './validate-structure';
import type {
  ContractMap,
  ContractName,
  SemanticValidator,
  ValidatedContract,
} from './types';

export async function validateContract<K extends ContractName>(
  name: K,
  bytes: Buffer,
  semantic: SemanticValidator,
): Promise<ValidatedContract<ContractMap[K]>> {
  // Snapshot before asynchronous work: callers cannot replace validated input in flight.
  const snapshot = Buffer.from(bytes);
  const payload = validateStructure(name, parseContractJson(snapshot));
  if (!(await semantic(name, payload, snapshot.toString('utf8'))))
    throw new ContractError('INVALID_CONTRACT');
  return payload as ValidatedContract<ContractMap[K]>;
}
