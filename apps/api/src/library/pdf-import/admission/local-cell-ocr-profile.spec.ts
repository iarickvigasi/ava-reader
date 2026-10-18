import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checksumBuffer } from '../../../shared/blob-utils';
import { pdfImportConfiguration } from './profile';
import { capturedSourcePolicies } from './captured-source-policies';
import { localPolicies } from '../../../pdf-conversion/reconstruction/local-cell-geometry-fixture';

it.each(['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'])(
  'captures new local method for %s while leaving historical captures unchanged',
  (profile) => {
    const args = [
      profile,
      localPolicies.sourceLayoutPolicy,
      localPolicies.sourceStructurePolicy,
      localPolicies.sourceNormalizationPolicy,
      localPolicies.recognitionRepairPolicy,
      localPolicies.sourceTitlePolicy,
      localPolicies.sourceContinuationPolicy,
    ] as const;
    const old = pdfImportConfiguration(...args);
    const current = pdfImportConfiguration(
      ...args,
      localPolicies.localCellGeometryPolicy,
    );
    const hash = (value: unknown) =>
      checksumBuffer(Buffer.from(JSON.stringify(value)));
    expect(hash(current)).not.toBe(hash(old));
    expect(capturedSourcePolicies(profile, hash(old))).not.toHaveProperty(
      'localCellGeometryPolicy',
    );
    expect(capturedSourcePolicies(profile, hash(current))).toHaveProperty(
      'localCellGeometryPolicy',
      localPolicies.localCellGeometryPolicy,
    );
    const supervisor = readFileSync(
      resolve(
        __dirname,
        '../../../../../../packages/pdf-epub/src/ava_pdf_epub/runtime/supervisor_exchange_configs.py',
      ),
      'utf8',
    );
    expect(supervisor).toContain(hash(current));
    if (profile.endsWith('v3'))
      expect(hash(old)).toBe(
        '11480edd876d3e5c41ae9a24af13ee33e797e6ea5176fcd3d2e68d46acf050bb',
      );
  },
);
it('refuses local method selection without the complete existing current stack', () => {
  expect(() =>
    pdfImportConfiguration(
      'ava-pdf-prose-en-uk-v3',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      localPolicies.localCellGeometryPolicy,
    ),
  ).toThrow();
});
