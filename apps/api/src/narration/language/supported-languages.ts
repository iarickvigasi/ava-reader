// Pronunciation language candidates; Google trial coverage remains provider-dependent.
export const NARRATION_LANGUAGE_CODES =
  'af ar hy as ast az be bn bs bg my yue ca ceb hr cs da nl en et fil fi fr gl ka de el gu ha he hi hu is id ga it ja jv kn kk ko ky lv ln lt lb mk ms ml mt zh mi mr mn ne no oc or ps fa pl pt pa ro ru sr sd sk sl so es sw sv tg ta te th tr uk ur uz vi cy yo'.split(
    ' ',
  );

const names = new Intl.DisplayNames(['en'], { type: 'language' });
const entries: Array<[string, string]> = NARRATION_LANGUAGE_CODES.map(
  (code) => [code, names.of(code) ?? code],
);
export const languageCriteria = Object.fromEntries(entries);
