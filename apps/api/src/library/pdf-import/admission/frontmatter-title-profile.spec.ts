import { checksumBuffer } from '../../../shared/blob-utils';
import {
  capturedSourceTitlePolicy,
  FRONTMATTER_TITLE_POLICY,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  NATIVE_WORD_WRAP_POLICY,
  pdfImportConfiguration,
  RECOGNITION_GEOMETRY_REPAIR_POLICY,
} from './profile';
import { capturedSourcePolicies } from './captured-source-policies';
import { validatePdfUpload } from './validate-upload';

const captures = [
  {
    profile: 'ava-pdf-prose-en-v2',
    titleHash:
      'd8bb90385b949c5bf22eefafdb427ff3a76a25ba3e8ce006f1e28c3c7f348e5b',
    geometryHash:
      '75709f32827723b3675d81bc84177b6d7dfffbb3f9abb8ada5f48e504f84db4a',
  },
  {
    profile: 'ava-pdf-prose-en-uk-v3',
    titleHash:
      '5fed6a113e4851d26b843716cf48bbddf954e64155c82fd0655e63607600b8d4',
    geometryHash:
      'a12919c9d07e696b224aafc0e4f5d648d0e66406306b443f58628609595073e4',
  },
] as const;
const policies = {
  sourceLayoutPolicy: NATIVE_LAYOUT_POLICY,
  sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
  sourceNormalizationPolicy: NATIVE_WORD_WRAP_POLICY,
  recognitionRepairPolicy: RECOGNITION_GEOMETRY_REPAIR_POLICY,
  sourceTitlePolicy: FRONTMATTER_TITLE_POLICY,
};
const preceding = [
  'sourceLayoutPolicy',
  'sourceStructurePolicy',
  'sourceNormalizationPolicy',
  'recognitionRepairPolicy',
] as const;
function configuration(profile: string, changes: Record<string, unknown> = {}) {
  const selected = { ...policies, ...changes };
  return pdfImportConfiguration(
    profile,
    selected.sourceLayoutPolicy,
    selected.sourceStructurePolicy,
    selected.sourceNormalizationPolicy,
    selected.recognitionRepairPolicy,
    selected.sourceTitlePolicy,
  );
}

describe.each(captures)(
  '$profile frontmatter title admission',
  ({ profile, titleHash, geometryHash }) => {
    it('pins its additive configuration and captures all required authorities', () => {
      expect(
        checksumBuffer(Buffer.from(JSON.stringify(configuration(profile)))),
      ).toBe(titleHash);
      expect(capturedSourceTitlePolicy(profile, titleHash)).toBe(
        FRONTMATTER_TITLE_POLICY,
      );
      expect(capturedSourcePolicies(profile, titleHash)).toEqual(policies);
      const other = captures.find((capture) => capture.profile !== profile)!;
      expect(
        capturedSourceTitlePolicy(profile, other.titleHash),
      ).toBeUndefined();
      expect(
        capturedSourceTitlePolicy(profile, 'f'.repeat(64)),
      ).toBeUndefined();
    });

    it('never grants title authority to any preceding configuration', () => {
      const historical = [
        pdfImportConfiguration(profile),
        pdfImportConfiguration(profile, NATIVE_LAYOUT_POLICY),
        pdfImportConfiguration(
          profile,
          NATIVE_LAYOUT_POLICY,
          NATIVE_STRUCTURE_POLICY,
        ),
        pdfImportConfiguration(
          profile,
          NATIVE_LAYOUT_POLICY,
          NATIVE_STRUCTURE_POLICY,
          NATIVE_WORD_WRAP_POLICY,
        ),
        configuration(profile, { sourceTitlePolicy: undefined }),
      ];
      for (const prior of historical) {
        const hash = checksumBuffer(Buffer.from(JSON.stringify(prior)));
        expect(hash).not.toBe(titleHash);
        expect(capturedSourceTitlePolicy(profile, hash)).toBeUndefined();
        expect(capturedSourcePolicies(profile, hash)).not.toHaveProperty(
          'sourceTitlePolicy',
        );
      }
      expect(
        checksumBuffer(Buffer.from(JSON.stringify(historical.at(-1)))),
      ).toBe(geometryHash);
    });

    it('keeps omitted and empty title selection on the existing geometry configuration', () => {
      const historical = configuration(profile, {
        sourceTitlePolicy: undefined,
      });
      expect(configuration(profile, { sourceTitlePolicy: '' })).toEqual(
        historical,
      );
      expect(historical).not.toHaveProperty('sourceTitlePolicy');
    });

    it.each(preceding)(
      'rejects absent, empty or foreign %s before admission',
      (key) => {
        for (const value of [undefined, '', 'foreign'])
          expect(() => configuration(profile, { [key]: value })).toThrow(
            'PDF_IMPORT_PROFILE_INVALID',
          );
      },
    );

    it('rejects foreign or malformed title authority', () => {
      for (const value of ['foreign', null, true])
        expect(() =>
          configuration(profile, { sourceTitlePolicy: value }),
        ).toThrow('PDF_IMPORT_PROFILE_INVALID');
    });

    it('changes new upload identity while preserving source bytes and historical identity', () => {
      const buffer = Buffer.from('%PDF-1.7 authored admission control');
      const original = Buffer.from(buffer);
      const input = {
        file: {
          buffer,
          size: buffer.length,
          originalname: 'Story.pdf',
        } as Express.Multer.File,
        idempotencyKey: 'request_1234567890',
        convertToEpub: true,
        profileId: profile,
        ...policies,
      };
      const historical = validatePdfUpload({
        ...input,
        sourceTitlePolicy: undefined,
      });
      const current = validatePdfUpload(input);
      expect(current.configSha256).toBe(titleHash);
      expect(historical.configSha256).toBe(geometryHash);
      expect(current.sourceSha256).toBe(historical.sourceSha256);
      expect(current.requestSha256).not.toBe(historical.requestSha256);
      expect(validatePdfUpload(input)).toEqual(current);
      expect(
        validatePdfUpload({ ...input, sourceTitlePolicy: undefined }),
      ).toEqual(historical);
      expect(buffer).toEqual(original);
    });
  },
);
