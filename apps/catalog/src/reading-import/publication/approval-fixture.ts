import type { Approval } from './types';
export const approvalFixture: Approval = {
  status: 'APPROVED',
  editionId: '11111111-1111-4111-8111-111111111111',
  checksum: 'a'.repeat(64),
  review: {
    sha256: 'a'.repeat(64),
    rightsStatement: 'Reviewed original text and all included contributions',
    rightsUrl: 'https://example.org/edition-evidence',
    rightsJurisdiction: 'Reviewed distribution scope',
    notes:
      'Reviewed full text, navigation, beginning/middle/end, and completeness',
    rightsConfirmed: true,
    qualityConfirmed: true,
  },
};
