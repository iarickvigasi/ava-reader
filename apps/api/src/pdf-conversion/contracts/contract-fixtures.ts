import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ContractName } from './types';

export function fixtureBytes(
  name: ContractName,
  variant?: 'source-pages',
): Buffer {
  return readFileSync(
    resolve(
      __dirname,
      '../../../../../packages/pdf-epub/tests/contracts/fixtures',
      `${name}${variant ? `-${variant}` : ''}.json`,
    ),
  );
}
