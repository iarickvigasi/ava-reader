import type { ReaderPackage } from '../../reader/reader-types';
import { parseReaderPackage } from '../../reader/package/parse-reader-package';
import { parseContractJson } from './parse-json';
import { ContractError } from './contract-error';
import type {
  ContractMap,
  SemanticValidator,
  ValidatedContract,
} from './types';
import { validateContract } from './validate-contract';

type NegotiatedReader =
  | { status: 'compatible'; version: 2; package: ReaderPackage }
  | {
      status: 'compatible';
      version: 3;
      package: ValidatedContract<ContractMap['ava-reader-3']>;
    }
  | { status: 'upgrade_required'; version: number };

export async function negotiateReader(
  bytes: Buffer,
  client: { versions: number[]; capabilities: string[] },
  semantic: SemanticValidator,
): Promise<NegotiatedReader> {
  const raw = parseContractJson(bytes);
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    !Number.isSafeInteger(raw.version)
  ) {
    throw new ContractError('INVALID_CONTRACT');
  }
  const version = raw.version as number;
  if (version !== 2 && version !== 3)
    throw new ContractError('UNSUPPORTED_SCHEMA');
  if (!client.versions.includes(version))
    return { status: 'upgrade_required', version };
  if (version === 2) {
    try {
      const legacy = parseReaderPackage(bytes);
      if (legacy.chapters.length === 0) throw new Error('empty');
      return { status: 'compatible', version, package: legacy };
    } catch {
      throw new ContractError('INVALID_CONTRACT');
    }
  }
  const book = await validateContract('ava-reader-3', bytes, semantic);
  if (
    book.required_capabilities.some(
      (required) => !client.capabilities.includes(required),
    )
  ) {
    return { status: 'upgrade_required', version };
  }
  return { status: 'compatible', version, package: book };
}
