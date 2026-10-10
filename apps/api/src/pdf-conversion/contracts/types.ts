import type { CanonicalBookV2 } from './generated/ava-book-2';
import type { JobInputV1 } from './generated/ava-pdf-job-1';
import type { WorkerResultV1 } from './generated/ava-pdf-worker-result-1';
import type { AcceptedContentV1 } from './generated/ava-accepted-content-1';
import type { ReaderPackageV3 } from './generated/ava-reader-3';

export type ContractMap = {
  'ava-book-2': CanonicalBookV2;
  'ava-pdf-job-1': JobInputV1;
  'ava-pdf-worker-result-1': WorkerResultV1;
  'ava-accepted-content-1': AcceptedContentV1;
  'ava-reader-3': ReaderPackageV3;
};
export type ContractName = keyof ContractMap;
declare const validated: unique symbol;
export type ValidatedContract<T> = T & { readonly [validated]: true };
export type SemanticValidator = (
  name: ContractName,
  payload: unknown,
  wireJson: string,
) => Promise<boolean>;
