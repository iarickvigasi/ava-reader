import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checksumBuffer } from '../../../shared/blob-utils';
import { capturedSourcePolicies } from './captured-source-policies';
import { pdfImportConfiguration } from './profile';

const workerCaptures = readFileSync(
  resolve(
    __dirname,
    '../../../../../../packages/pdf-epub/src/ava_pdf_epub/runtime/supervisor_exchange_configs.py',
  ),
  'utf8',
);

it.each(['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'])(
  'keeps the current supervisor capture aligned with API admission for %s',
  (profile) => {
    const configuration = pdfImportConfiguration(
      profile,
      'ava-native-layout-1',
      'ava-native-structure-2',
      'ava-native-word-wrap-1',
      'ava-recognition-geometry-repair-2',
      'ava-frontmatter-title-1',
      'ava-source-continuation-presentation-1',
    );
    const hash = checksumBuffer(Buffer.from(JSON.stringify(configuration)));
    expect(workerCaptures).toContain(`"${profile}": "${hash}"`);
    expect(capturedSourcePolicies(profile, hash).sourceContinuationPolicy).toBe(
      'ava-source-continuation-presentation-1',
    );
  },
);
