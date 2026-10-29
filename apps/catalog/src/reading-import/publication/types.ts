export type Approval = {
  status: 'APPROVED';
  editionId: string;
  checksum: string;
  review: {
    sha256: string;
    rightsStatement: string;
    rightsUrl: string;
    rightsJurisdiction: string;
    notes: string;
    rightsConfirmed: true;
    qualityConfirmed: true;
  };
};
export type PublicationBook = {
  id: string;
  title: string;
  publication?: Approval | null;
};
