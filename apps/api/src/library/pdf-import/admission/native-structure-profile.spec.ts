import { checksumBuffer } from '../../../shared/blob-utils';
import {
  PDF_IMPORT_PROFILE,
  PDF_IMPORT_PROFILE_V3,
  NATIVE_LAYOUT_POLICY,
  NATIVE_STRUCTURE_POLICY,
  capturedSourceLayoutPolicy,
  capturedSourceStructurePolicy,
  pdfImportConfiguration,
} from './profile';
const hash = (value: unknown) =>
  checksumBuffer(Buffer.from(JSON.stringify(value)));
const cases = [
  [
    PDF_IMPORT_PROFILE,
    '937942d4a700d14ac59de24559044e098726fe355173f93680dd4fe0a9929060',
    '34b6f1e448f7311d3cd8f6c27b404f6d9e3904b461225895b4151d588c5749d7',
  ],
  [
    PDF_IMPORT_PROFILE_V3,
    'da2d14755d575a3b0fe0c8a0430dfe093996e144e62bf31c2cc04df450a4e315',
    '0b3ad573e34a52e32bd2ebbe67fbb6f573676a262ef31f1c41c9c19929872fb8',
  ],
] as const;

it.each(cases)(
  'captures distinct native structure authority while preserving old layout bytes for %j',
  (profile, oldHash, newHash) => {
    const old = pdfImportConfiguration(profile.profileId, NATIVE_LAYOUT_POLICY);
    const current = pdfImportConfiguration(
      profile.profileId,
      NATIVE_LAYOUT_POLICY,
      NATIVE_STRUCTURE_POLICY,
    );
    expect(hash(old)).toBe(oldHash);
    expect(hash(current)).toBe(newHash);
    expect(current).toEqual({
      ...old,
      sourceStructurePolicy: NATIVE_STRUCTURE_POLICY,
    });
    expect(
      pdfImportConfiguration(profile.profileId, NATIVE_LAYOUT_POLICY, ''),
    ).toBe(old);
    expect(
      capturedSourceStructurePolicy(profile.profileId, oldHash),
    ).toBeUndefined();
    expect(capturedSourceStructurePolicy(profile.profileId, newHash)).toBe(
      NATIVE_STRUCTURE_POLICY,
    );
    expect(capturedSourceLayoutPolicy(profile.profileId, newHash)).toBe(
      NATIVE_LAYOUT_POLICY,
    );
    const other =
      profile === PDF_IMPORT_PROFILE
        ? PDF_IMPORT_PROFILE_V3
        : PDF_IMPORT_PROFILE;
    expect(
      capturedSourceStructurePolicy(other.profileId, newHash),
    ).toBeUndefined();
  },
);

it.each(['unknown', null, false, {}, 'ava-native-structure-2'])(
  'refuses unknown structure authority %j',
  (value) => {
    expect(() =>
      pdfImportConfiguration(
        PDF_IMPORT_PROFILE.profileId,
        NATIVE_LAYOUT_POLICY,
        value,
      ),
    ).toThrow('PDF_IMPORT_PROFILE_INVALID');
  },
);
it.each([undefined, '', 'unknown'])(
  'requires layout authority alongside structure policy %j',
  (layout) => {
    expect(() =>
      pdfImportConfiguration(
        PDF_IMPORT_PROFILE.profileId,
        layout,
        NATIVE_STRUCTURE_POLICY,
      ),
    ).toThrow('PDF_IMPORT_PROFILE_INVALID');
  },
);
