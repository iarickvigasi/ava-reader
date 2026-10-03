import Ajv2020 from 'ajv/dist/2020';
import { contractSchemas } from './generated/schemas';
import { ContractError } from './contract-error';
import type { ContractMap, ContractName } from './types';

const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  validateFormats: false,
});
// Pydantic discriminator is an annotation; JSON Schema oneOf remains authoritative.
ajv.addKeyword({ keyword: 'discriminator', valid: true });
const validators = new Map(
  Object.entries(contractSchemas).map(([name, schema]) => [
    name,
    ajv.compile(schema),
  ]),
);

// Only checked-in schemas compile; payloads cannot introduce schemas, URLs or coercion.
export function validateStructure<K extends ContractName>(
  name: K,
  data: unknown,
): ContractMap[K] {
  const validate = validators.get(name);
  if (!validate) throw new ContractError('UNSUPPORTED_SCHEMA');
  if (!validate(data)) throw new ContractError('INVALID_CONTRACT');
  return data as unknown as ContractMap[K];
}
